import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "GuardTrace AI Gateway"
    VERSION: str = "0.1.0"
    API_PREFIX: str = "/v1"

    # Database
    DATABASE_URL: str

    # JWT Authentication
    SECRET_KEY: str
    ALGORITHM: str = "HS256"

    FRONTEND_URL: str = os.getenv("FRONTEND_URL")

    # Upstream Gemini Configuration
    UPSTREAM_GEMINI_URL: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    DEFAULT_MODEL: str = "gemini-3.6-flash"

    # Redis Cache Configuration
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", 6379))
    REDIS_TTL_SECONDS: int = 3600

    # Free daily limit
    FREE_DAILY_LIMIT: int = int(os.getenv("FREE_DAILY_LIMIT", 20))
    PII_CONFIDENCE_THRESHOLD: float = 0.5
    ENABLE_ML_CLASSIFIER: bool = False
    ML_MODEL_NAME: str = "protectai/deberta-v3-base-prompt-injection-v2"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()