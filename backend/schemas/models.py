from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))

class Conversation(Base):
    __tablename__="conversations"

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id")
    )

    title: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    conversion_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id")
    )
    role: Mapped[str] = mapped_column(
        String(20)
    )
    content: Mapped[str] = mapped_column(
        Text
    )

class SecurityEvent(Base):
    __tablename__ = "security_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    conversation_id: Mapped[int | None] = mapped_column(
        ForeignKey("conversations.id"),
        nullable=True
    )
    event_type: Mapped[str] = mapped_column(String(50))
    risk_score: Mapped[float] = mapped_column()
    detected_pii: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )