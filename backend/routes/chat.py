from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import engine
from schemas.models import Conversation, Message, SecurityEvent
from core.dependencies import get_current_user_id
from schemas.chat import ChatRequest
from schemas.openai import ChatMessage
from gemini_client import gemini_client
from ml.risk_classifier import risk_classifier
from core.cache import cache_engine
from config import settings

router = APIRouter(
    prefix="/chat",
    tags=["Chat"]
)


@router.post("")
async def chat(
    data: ChatRequest,
    user_id: int = Depends(get_current_user_id)
):

    with Session(engine) as session:

        # 1. Find conversation
        conversation = session.get(
            Conversation,
            data.conversation_id
        )

        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )

        # 2. Check ownership
        if conversation.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this conversation"
            )

        current_usage = await cache_engine.get_usage(user_id)
        if current_usage >= settings.FREE_DAILY_LIMIT:
            raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "message": "Free plan daily limit reached",
                        "used": current_usage,
                        "limit": settings.FREE_DAILY_LIMIT
                    }
                )

        # 3. Get previous messages
        previous_messages = (
            session.query(Message)
            .filter(
                Message.conversation_id == data.conversation_id
            )
            .order_by(Message.id.asc())
            .all()
        )

        # 4. Build Gemini messages
        messages = [
            ChatMessage(
                role=message.role,
                content=message.content
            )
            for message in previous_messages
        ]

        inspection = risk_classifier.inspect_prompt(data.message)
        if not inspection["is_safe"]:
            event = SecurityEvent(
                user_id=user_id,
                conversation_id=data.conversation_id,
                event_type="BLOCKED_PROMPT",
                risk_score=inspection["risk_score"],
                detected_pii=",".join(inspection["detected_pii"])
            )

            session.add(event)
            session.commit()
        
            raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error": "Message blocked by security system",
                        "risk_score": inspection["risk_score"],
                        "detected_pii": inspection["detected_pii"]
                    }
                )
        
        # 5. Add current user message
        messages.append(
            ChatMessage(
                role="user",
                content=data.message
            )
        )
        cache_key = cache_engine.generate_cache_key(
            model="gemini-1.5-flash",
            messages=messages
        )

        cached_response = await cache_engine.get_cached_response(cache_key)
        if cached_response:
            response = cached_response["message"]


        # 6. Call Gemini
        response = await gemini_client.generate_response(
            model="gemini-1.5-flash",
            messages=messages
        )

        # 7. Save user message
        user_message = Message(
            conversation_id=data.conversation_id,
            role="user",
            content=data.message
        )

        # 8. Save assistant response
        assistant_message = Message(
            conversation_id=data.conversation_id,
            role="assistant",
            content=response
        )

        session.add(user_message)
        session.add(assistant_message)
        session.commit()

        return {
            "conversation_id": data.conversation_id,
            "message": response
        }