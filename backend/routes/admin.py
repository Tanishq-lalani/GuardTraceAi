from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import engine
from schemas.models import User
from schemas.auth_model import CreateUserRequest
from core.auth import hash_password
from core.dependencies import require_admin

router = APIRouter(
prefix="/admin",
tags=["Admin"]
)

@router.post("/users")
def create_user(
data: CreateUserRequest,
admin: User = Depends(require_admin)
):
    with Session(engine) as session:
        existing_user = session.query(User).filter(
                User.email == data.email
            ).first()
        
        if existing_user:
            return {
                   "error": "User with this email already exists"
            }
        
        password_hash = hash_password(data.password)
        
        user = User(
                name=data.name,
                email=data.email,
                password_hash=password_hash,
                role="user",
                is_active=True
        )
        
        session.add(user)
        session.commit()
        session.refresh(user)
        
        return {
                "message": "User created successfully",
                "user_id": user.id,
                "name": user.name,
                "email": user.email,
                "role": user.role
        }
