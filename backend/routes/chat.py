import asyncio
import logging
import time

from fastapi import APIRouter, Depends, HTTPException, status
from google.genai import errors as genai_errors
from sqlalchemy.orm import Session

from config import settings
from core.cache import cache_engine
from core.dependencies import get_current_user_id
from database import engine
from gemini_client import gemini_client
from ml.risk_classifier import risk_classifier
from schemas.chat import ChatRequest
from schemas.models import Conversation, Message, SecurityEvent, User
from schemas.openai import ChatMessage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Chat"])


def _severity(risk: float) -> str:
    return "high" if risk >= 0.8 else "medium" if risk >= 0.5 else "low"


@router.post("")
async def chat(data: ChatRequest, user_id: int = Depends(get_current_user_id)):
    with Session(engine) as session:
        # 1. User, conversation, ownership
        user = session.get(User, user_id)
        if not user or not user.is_active:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is inactive")
        if user.must_change_password:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Please change your temporary password first")

        conversation = session.get(Conversation, data.conversation_id)
        if not conversation:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
        if conversation.user_id != user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this conversation")

        # 2. Daily limit
        current_usage = await cache_engine.get_usage(user_id)
        if current_usage >= settings.FREE_DAILY_LIMIT:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "message": "Daily limit reached",
                    "used": current_usage,
                    "limit": settings.FREE_DAILY_LIMIT,
                },
            )

        # 3. Security check before anything is stored or sent to Gemini
        inspection = await asyncio.to_thread(risk_classifier.inspect_prompt, data.message)
        if not inspection["is_safe"]:
            risk = inspection["risk_score"]
            injection = inspection.get("injection_detected", False)
            session.add(
                SecurityEvent(
                    organization_id=user.organization_id,
                    user_id=user_id,
                    conversation_id=data.conversation_id,
                    event_type="PROMPT_INJECTION" if injection and not inspection["detected_pii"] else "BLOCKED_PROMPT",
                    action_taken="blocked",
                    severity=_severity(risk),
                    risk_score=risk,
                    detected_pii=",".join(inspection["detected_pii"]),  # types only, never the secret
                )
            )
            session.commit()
            await cache_engine.increment_usage(user_id)   # blocked attempts count toward the limit
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "Message blocked by security system",
                    "risk_score": risk,
                    "detected_pii": inspection["detected_pii"],
                    "injection_detected": injection,
                },
            )

        # 4. Build the conversation for Gemini
        previous = (
            session.query(Message)
            .filter(Message.conversation_id == data.conversation_id)
            .order_by(Message.id.asc())
            .all()
        )
        messages = [ChatMessage(role=m.role, content=m.content) for m in previous]
        messages.append(ChatMessage(role="user", content=data.message))

        # 5. Cache (per organization), Gemini only on a miss
        model = settings.DEFAULT_MODEL
        cache_key = cache_engine.generate_cache_key(
            model=model, messages=messages, scope=f"org:{user.organization_id}"
        )

        started = time.perf_counter()
        cached = await cache_engine.get_cached_response(cache_key)

        if cached:
            reply = cached["message"]
            prompt_tokens = completion_tokens = 0
            was_cached = True
        else:
            try:
                result = await gemini_client.generate_response(model=model, messages=messages)
            except genai_errors.ClientError as e:
                logger.exception("Gemini client error")
                if e.code == 429:
                    raise HTTPException(429, "The AI service is rate limited. Please try again shortly.")
                raise HTTPException(502, "The AI service rejected the request.")
            except genai_errors.ServerError:
                logger.exception("Gemini server error")
                raise HTTPException(503, "The AI service is temporarily unavailable.")

            reply = result.text
            prompt_tokens = result.prompt_tokens
            completion_tokens = result.completion_tokens
            was_cached = False
            await cache_engine.set_cached_response(cache_key, {"message": reply})

        latency_ms = int((time.perf_counter() - started) * 1000)

        # 6. Save both messages with their usage
        session.add(
            Message(
                conversation_id=data.conversation_id,
                role="user",
                content=data.message,
                model=model,
                prompt_tokens=prompt_tokens,
                cached=was_cached,
            )
        )
        session.add(
            Message(
                conversation_id=data.conversation_id,
                role="assistant",
                content=reply,
                model=model,
                completion_tokens=completion_tokens,
                cached=was_cached,
                latency_ms=latency_ms,
            )
        )
        session.commit()

        # 7. Count the request
        used = await cache_engine.increment_usage(user_id)

        return {
            "conversation_id": data.conversation_id,
            "message": reply,
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "cached": was_cached,
                "requests_today": used,
                "daily_limit": settings.FREE_DAILY_LIMIT,
            },
        }