from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
import asyncio
from core.cache import cache_engine

from core.auth import create_access_token, hash_password, verify_password
from core.dependencies import get_current_user_id
from database import engine
from schemas.auth_model import ChangePasswordRequest, LoginRequest, RegisterRequest
from schemas.models import Organization, User

router = APIRouter(prefix="/auth", tags=["Authentication"])


DUMMY_HASH = hash_password("not-a-real-password")


def _authenticate(email: str, password: str):
    with Session(engine) as session:
        user = session.query(User).filter(User.email == email).first()
        valid = verify_password(password, user.password_hash if user else DUMMY_HASH)
        if not user or not valid:
            return "invalid", None
        if not user.is_active:
            return "inactive", None
        user.last_login_at = datetime.now(timezone.utc)
        session.commit()
        return "ok", {
            "id": user.id,
            "role": user.role,
            "must_change_password": user.must_change_password,
        }

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_organization(data: RegisterRequest):
    email = data.email.strip().lower()

    with Session(engine) as session:
        if session.query(User).filter(User.email == email).first():
            raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")

        try:
            org = Organization(name=data.organization_name.strip())
            session.add(org)
            session.flush()  # gets org.id

            admin = User(
                organization_id=org.id,
                name=data.name.strip(),
                email=email,
                password_hash=hash_password(data.password),
                role="admin",
                is_active=True,
            )
            session.add(admin)
            session.commit()
            session.refresh(admin)
        except IntegrityError:
            session.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")

        return {
            "message": "Organization created successfully",
            "organization_id": org.id,
            "user_id": admin.id,
            "email": admin.email,
        }


@router.post("/login")
async def login_user(data: LoginRequest, request: Request):
    email = data.email.strip().lower()
    ip = request.client.host if request.client else "unknown"

    retry_after = await cache_engine.login_blocked(email, ip)
    if retry_after:
        minutes = -(-retry_after // 60)
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed attempts. Try again in {minutes} minute(s).",
            headers={"Retry-After": str(retry_after)},
        )

    # bcrypt and the DB query are blocking, so keep them off the event loop
    outcome, user = await asyncio.to_thread(_authenticate, email, data.password)

    if outcome == "invalid":
        await cache_engine.record_login_failure(email, ip)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if outcome == "inactive":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is inactive")

    await cache_engine.clear_login_failures(email, ip)
    return {
        "message": "Login successful",
        "access_token": create_access_token(user["id"]),
        "token_type": "bearer",
        "user_id": user["id"],
        "role": user["role"],
        "must_change_password": user["must_change_password"],
    }

@router.get("/me")
def get_my_profile(user_id: int = Depends(get_current_user_id)):
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        org = session.get(Organization, user.organization_id)
        return {
            "user_id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
            "organization_id": user.organization_id,
            "organization_name": org.name if org else None,
            "must_change_password": user.must_change_password,
        }


@router.post("/change-password")
def change_password(data: ChangePasswordRequest, user_id: int = Depends(get_current_user_id)):
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        if not verify_password(data.current_password, user.password_hash):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
        if data.current_password == data.new_password:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "New password must be different")

        user.password_hash = hash_password(data.new_password)
        user.must_change_password = False
        session.commit()
        return {"message": "Password changed successfully"}