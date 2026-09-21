import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "GuardTrace AI Gateway"
    VERSION: str = "0.1.0"
    API_PREFIX: str = "/v1"

    # Upstream Gemini Configuration (Using OpenAI-compatible route)
    UPSTREAM_GEMINI_URL: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    DEFAULT_MODEL: str = "gemini-1.5-flash"

    # Redis Cache Configuration
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", 6379))
    REDIS_TTL_SECONDS: int = 3600

    class Config:
        env_file = ".env"

settings = Settings()