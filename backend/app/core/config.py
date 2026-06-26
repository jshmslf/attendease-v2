from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List


class Settings(BaseSettings):
    # App
    APP_NAME: str = "AttendEase"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/attendease"

    # JWT
    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3001"]

    # Face Recognition
    FACE_MATCH_THRESHOLD: float = 0.6  # Lower = stricter matching
    LOCAL_STORAGE_PATH: str = "static/faces"
    LATE_THRESHOLD_HOUR: int = 8  # Students arriving at or after this hour are marked late

    # PhilSMS
    PHILSMS_TOKEN: str = ""
    PHILSMS_SENDER_ID: str = "PhilSMS"

    class Config:
        env_file = ".env"
        extra = "ignore"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_database_url(cls, v: str) -> str:
        # Convert plain postgresql:// to asyncpg dialect
        if v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        # asyncpg uses ssl=require, not sslmode=require
        v = v.replace("sslmode=require", "ssl=require")
        # channel_binding is not supported by asyncpg
        v = v.replace("&channel_binding=require", "").replace("channel_binding=require&", "").replace("channel_binding=require", "")
        # Clean trailing ? or &
        if v.endswith("?") or v.endswith("&"):
            v = v[:-1]
        return v


settings = Settings()
