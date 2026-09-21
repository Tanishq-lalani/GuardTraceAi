import json
import hashlib
import redis.asyncio as aioredis
from typing import Optional, Dict, Any, List
from config import settings
from schemas.openai import ChatMessage

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

    def generate_cache_key(self, model: str, messages: List[ChatMessage]) -> str:
        """
        Generates a deterministic SHA-256 hash key based on the model name and message history.
        
        Example input: model="gemini-1.5-flash", messages=[{"role": "user", "content": "Hello"}]
        Example key output: "gt_cache:a8f5f167f44f4964e6c998dee827110c..."
        """
        # Convert message objects into a sorted, serialized JSON string
        serialized_payload = json.dumps(
            {
                "model": model,
                # Convert Pydantic ChatMessage objects to standard dicts
                "messages": [m.model_dump() for m in messages]
            },
            sort_keys=True  # Sorting keys ensures consistent ordering
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

cache_engine = CacheEngine()