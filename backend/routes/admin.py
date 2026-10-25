import secrets
import string
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from core.auth import hash_password
from core.dependencies import require_admin
from database import engine
from schemas.auth_model import CreateUserRequest, UserStatusRequest
from schemas.models import User

router = APIRouter(prefix="/admin", tags=["Admin"])


def _temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _user_dict(u: User) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "role": u.role,
        "is_active": u.is_active,
        "must_change_password": u.must_change_password,
        "created_at": u.created_at,
        "last_login_at": u.last_login_at,
    }


def _get_org_employee(session: Session, admin: User, user_id: int) -> User:
    user = (
        session.query(User)
        .filter(User.id == user_id, User.organization_id == admin.organization_id)
        .first()
    )
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if user.role == "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin accounts cannot be changed here")
    return user


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(data: CreateUserRequest, admin: User = Depends(require_admin)):
    email = data.email.strip().lower()
    temp_password = _temp_password()

    with Session(engine) as session:
        if session.query(User).filter(User.email == email).first():
            raise HTTPException(status.HTTP_409_CONFLICT, "A user with this email already exists")

        user = User(
            organization_id=admin.organization_id,   # from the admin, not the request
            created_by=admin.id,
            name=data.name.strip(),
            email=email,
            password_hash=hash_password(temp_password),
            role="user",                              # always "user"
            is_active=True,
            must_change_password=True,
        )
        try:
            session.add(user)
            session.commit()
            session.refresh(user)
        except IntegrityError:
            session.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, "A user with this email already exists")

        return {
            "message": "User created. Share the temporary password securely; it is shown only once.",
            "user": _user_dict(user),
            "temporary_password": temp_password,
        }


@router.get("/users")
def list_users(admin: User = Depends(require_admin)):
    with Session(engine) as session:
        users = (
            session.query(User)
            .filter(User.organization_id == admin.organization_id)
            .order_by(User.id.asc())
            .all()
        )
        return [_user_dict(u) for u in users]


@router.patch("/users/{user_id}/status")
def set_user_status(user_id: int, data: UserStatusRequest, admin: User = Depends(require_admin)):
    with Session(engine) as session:
        user = _get_org_employee(session, admin, user_id)
        user.is_active = data.is_active
        session.commit()
        session.refresh(user)
        return _user_dict(user)


@router.post("/users/{user_id}/reset-password")
def reset_user_password(user_id: int, admin: User = Depends(require_admin)):
    temp_password = _temp_password()
    with Session(engine) as session:
        user = _get_org_employee(session, admin, user_id)
        user.password_hash = hash_password(temp_password)
        user.must_change_password = True
        session.commit()
        return {"message": "Password reset. It is shown only once.", "temporary_password": temp_password}