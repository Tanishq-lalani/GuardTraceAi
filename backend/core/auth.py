import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
import os
from dotenv import load_dotenv

load_dotenv()


def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    password_bytes = password.encode("utf-8")
    hash_bytes = password_hash.encode("utf-8")

    return bcrypt.checkpw(password_bytes, hash_bytes)

def create_access_token(user_id: int) -> str:

    expire = datetime.now(timezone.utc) + timedelta(hours=1)

    payload = {
        "sub": str(user_id),
        "exp": expire
    }

    token = jwt.encode(
        payload,
        os.getenv("SECRET_KEY"),
        algorithm=os.getenv("ALGORITHM")
    )

    return token