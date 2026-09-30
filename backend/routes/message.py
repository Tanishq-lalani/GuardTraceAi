from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import engine
from schemas.models import Conversation, Message
from core.dependencies import get_current_user_id
from schemas.message import CreateMessageRequest


router = APIRouter(
    prefix="/conversations",
    tags=["Messages"]
)


@router.post("/{conversation_id}/messages")
def create_message(
    conversation_id: int,
    data: CreateMessageRequest,
    user_id: int = Depends(get_current_user_id)
):

    with Session(engine) as session:

        conversation = session.get(
            Conversation,
            conversation_id
        )

        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )

        if conversation.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this conversation"
            )

        message = Message(
            conversation_id=conversation_id,
            role=data.role,
            content=data.content
        )

        session.add(message)
        session.commit()
        session.refresh(message)

        return {
            "message_id": message.id,
            "conversation_id": conversation_id,
            "role": message.role,
            "content": message.content
        }

@router.get("/{conversation_id}/messages")
def get_messages(
    conversation_id: int,
    user_id: int = Depends(get_current_user_id)
):

    with Session(engine) as session:

        conversation = session.get(
            Conversation,
            conversation_id
        )

        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found"
            )

        if conversation.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this conversation"
            )

        messages = (
            session.query(Message)
            .filter(
                Message.conversation_id == conversation_id
            )
            .order_by(Message.id.asc())
            .all()
        )

        return [
            {
                "message_id": message.id,
                "role": message.role,
                "content": message.content
            }
            for message in messages
        ]