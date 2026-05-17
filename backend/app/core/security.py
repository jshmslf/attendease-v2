from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import logging

from app.core.config import settings
from app.db.session import get_db

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()
api_key_header = APIKeyHeader(name="X-Camera-API-Key", auto_error=False)

# Hardcoded camera API key for thesis — move to DB/env in production
CAMERA_API_KEY = "attendease-camera-secret-key"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


async def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    from app.models.models import AdminAccount

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid admin credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(credentials.credentials)
        user_id: str = payload.get("sub")
        role: str = payload.get("role")
        if not user_id or role != "admin":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(
        select(AdminAccount).where(AdminAccount.id == user_id)
    )
    admin = result.scalar_one_or_none()
    if not admin or not admin.is_active:
        raise credentials_exception
    return admin


async def get_current_student(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    from app.models.models import PortalAccount, Student

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid student credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(credentials.credentials)
        account_id: str = payload.get("sub")
        role: str = payload.get("role")
        if not account_id or role != "student":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(
        select(PortalAccount).where(PortalAccount.id == account_id)
    )
    account = result.scalar_one_or_none()
    if not account or not account.is_active:
        raise credentials_exception

    student_result = await db.execute(
        select(Student).where(Student.id == account.student_id)
    )
    student = student_result.scalar_one_or_none()
    if not student:
        raise credentials_exception
    return student


def verify_api_key(api_key: str = Security(api_key_header)):
    """Used by camera gateway to authenticate frame submissions."""
    if api_key != CAMERA_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid camera API key.",
        )
