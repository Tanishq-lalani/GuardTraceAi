from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from schemas.models import User
from core.auth import verify_access_token
from sqlalchemy.orm import Session
from database import engine

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login"
)


def get_current_user_id(
    token: str = Depends(oauth2_scheme)
) -> int:

    return verify_access_token(token)

def get_current_user(user_id: int = Depends(get_current_user_id)) -> User:
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User Nor Found"
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is Inactive"
            )
        return user

def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in ["admin","controller"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return user

def require_controller(
        user: User = Depends(get_current_user)
) -> User:
    if user.role != "controller":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Controller access required"
        )
    return user


