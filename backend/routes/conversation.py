from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import engine
from schemas.models import Conversation
from core.dependencies import get_current_user_id
from schemas.conversations import CreateConversationRequest

router = APIRouter(
    prefix="/conversations",
    tags=["Conversations"]
)


@router.post("")
def create_conversation(
    data: CreateConversationRequest,
    user_id: int = Depends(get_current_user_id)
):

    with Session(engine) as session:

        conversation = Conversation(
            user_id=user_id,
            title=data.title
        )

        session.add(conversation)
        session.commit()
        session.refresh(conversation)

        return {
            "message": "Conversation created successfully",
            "conversation_id": conversation.id,
            "title": conversation.title
        }

@router.get("")
def get_my_conversations(
    user_id: int = Depends(get_current_user_id)
):

    with Session(engine) as session:

        conversations = (
            session.query(Conversation)
            .filter(Conversation.user_id == user_id)
            .order_by(Conversation.id.desc())
            .all()
        )

        return [
            {
                "conversation_id": conversation.id,
                "title": conversation.title
            }
            for conversation in conversations
        ]