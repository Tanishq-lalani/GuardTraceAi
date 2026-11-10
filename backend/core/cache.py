import json
import hashlib
import redis.asyncio as aioredis
from datetime import date
from typing import Optional, Dict, Any, List
from config import settings
from schemas.openai import ChatMessage
import logging
from redis.exceptions import RedisError



logger = logging.getLogger(__name__)

class CacheEngine:
    def __init__(self):
        self.redis: Optional[aioredis.Redis] = None

    async def connect(self):
        self.redis = aioredis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            decode_responses=True  # Automatically converts bytes to Python strings
        )

    async def close(self):
        """Gracefully closes the Redis connection on server shutdown."""
        if self.redis:
            await self.redis.close()

    def generate_cache_key(
        self,
        model: str,
        messages: List[ChatMessage],
        scope: str = "",
        temperature: float = 0.7,
        top_p: float = 1.0,
        max_tokens: int | None = None,
    ) -> str:
        serialized_payload = json.dumps(
            {
                "scope": scope,   # e.g. "org:3", keeps tenants separate
                "model": model,
                "messages": [m.model_dump() for m in messages],
                "temperature": temperature,
                "top_p": top_p,
                "max_tokens": max_tokens,
            },
            sort_keys=True,
        )
        hash_digest = hashlib.sha256(serialized_payload.encode("utf-8")).hexdigest()
        return f"gt_cache:{hash_digest}"

    async def get_cached_response(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Retrieves a cached JSON response from Redis if it exists."""
        if not self.redis:
            return None
            
        cached_data = await self.redis.get(cache_key)
        if cached_data:
            # Parse the JSON string back into a Python dictionary
            return json.loads(cached_data)
        return None

    async def set_cached_response(self, cache_key: str, data: Dict[str, Any]):
        """Saves a JSON response dictionary into Redis with an expiration time (TTL)."""
        if self.redis:
            await self.redis.set(
                name=cache_key,
                value=json.dumps(data),
                ex=settings.REDIS_TTL_SECONDS  # Key auto-deletes after 3600 seconds (1 hour)
            )

    def generate_usage_key(self, user_id: int) -> str:

        today = date.today().isoformat()

        return f"gt_usage:{user_id}:{today}"

    async def get_usage(self, user_id: int) -> int:

        if not self.redis:
            return 0

        key = self.generate_usage_key(user_id)

        value = await self.redis.get(key)

        if value is None:
            return 0

        return int(value)

    async def increment_usage(
        self,
        user_id: int
    ) -> int:

        if not self.redis:
            return 0

        key = self.generate_usage_key(user_id)

        count = await self.redis.incr(key)

        # Keep the counter for 24 hours.
        # The date-based key ensures a new counter is
        # automatically used on the next calendar day.
        if count == 1:
            await self.redis.expire(
                key,
                86400
            )

        return count

        # ---------- Login rate limiting ----------

    @staticmethod
    def _login_keys(email: str, ip: str) -> tuple[str, str]:
        return f"gt_login_fail:{ip}:{email}", f"gt_login_fail_ip:{ip}"

    async def login_blocked(self, email: str, ip: str) -> int:
        """Seconds until the caller may retry, or 0 if not blocked."""
        if not self.redis:
            return 0
        pair_key, ip_key = self._login_keys(email, ip)
        try:
            pair = int(await self.redis.get(pair_key) or 0)
            per_ip = int(await self.redis.get(ip_key) or 0)
            if pair >= settings.LOGIN_MAX_ATTEMPTS:
                return max(await self.redis.ttl(pair_key), 1)
            if per_ip >= settings.LOGIN_MAX_ATTEMPTS_PER_IP:
                return max(await self.redis.ttl(ip_key), 1)
        except RedisError:
            logger.warning("Login rate limiter unavailable", exc_info=True)
        return 0

    async def record_login_failure(self, email: str, ip: str) -> None:
        if not self.redis:
            return
        try:
            for key in self._login_keys(email, ip):
                count = await self.redis.incr(key)
                if count == 1:
                    await self.redis.expire(key, settings.LOGIN_WINDOW_SECONDS)
        except RedisError:
            logger.warning("Could not record login failure", exc_info=True)

    async def clear_login_failures(self, email: str, ip: str) -> None:
        if not self.redis:
            return
        try:
            await self.redis.delete(self._login_keys(email, ip)[0])
        except RedisError:
            pass

cache_engine = CacheEngine()