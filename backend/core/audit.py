from sqlalchemy.orm import Session

from schemas.models import AuditLog, User


def log_action(
    session: Session,
    admin: User,
    action: str,
    target_user_id: int | None = None,
    conversation_id: int | None = None,
) -> None:
    """Adds an audit row to the caller's session. The caller commits."""
    session.add(
        AuditLog(
            organization_id=admin.organization_id,
            admin_id=admin.id,
            action=action,
            target_user_id=target_user_id,
            conversation_id=conversation_id,
        )
    )