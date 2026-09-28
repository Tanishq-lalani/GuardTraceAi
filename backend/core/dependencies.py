from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer

from core.auth import verify_access_token


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login"
)


def get_current_user_id(
    token: str = Depends(oauth2_scheme)
) -> int:

    return verify_access_token(token)