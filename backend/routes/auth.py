from fastapi import APIRouter
from sqlalchemy.orm import Session
from database import engine
from schemas.models import User
from core.auth import hash_password, verify_password, create_access_token
from schemas.auth_model import RegisterRequest, LoginRequest

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

@router.post("/register")
def register_user(data: RegisterRequest):
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
            password_hash=password_hash
        )

        session.add(user)
        session.commit()
        session.refresh(user)
        return {
            "message": "User registered successfully",
            "user_id": user.id,
            "name": user.name,
            "email": user.email
        }

@router.post("/login")
def login_user(data: LoginRequest):

    with Session(engine) as session:
        user = session.query(User).filter(
            User.email == data.email
        ).first()

        if not user:
            return {
                "error": "User Not Exist"
            }

        if not verify_password(data.password, user.password_hash):
            return {
                "error": "Invalid email or password"
            }

        access_token = create_access_token(user.id)

        return {
            "message": "Login successful",
            "access_token": access_token,
            "token_type": "bearer",
            "user_id": user.id
        }