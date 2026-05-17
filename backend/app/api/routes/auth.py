from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.db.session import get_db
from app.models.models import AdminAccount, PortalAccount, Student
from app.core.security import verify_password, create_access_token
from app.core.timezone import ph_now

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class StudentLoginRequest(BaseModel):
    student_id: str
    password: str


@router.post("/admin/login")
async def admin_login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AdminAccount).where(AdminAccount.username == data.username)
    )
    admin = result.scalar_one_or_none()

    if not admin or not verify_password(data.password, admin.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    admin.last_login = ph_now()
    await db.commit()

    token = create_access_token({"sub": admin.id, "role": "admin", "name": admin.full_name})
    return {"access_token": token, "token_type": "bearer", "name": admin.full_name}


@router.post("/student/login")
async def student_login(data: StudentLoginRequest, db: AsyncSession = Depends(get_db)):
    # Look up student by their school ID, then find their portal account
    student_result = await db.execute(
        select(Student).where(Student.student_id == data.student_id)
    )
    student = student_result.scalar_one_or_none()

    if not student:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Student ID or password.",
        )

    account_result = await db.execute(
        select(PortalAccount).where(PortalAccount.student_id == student.id)
    )
    account = account_result.scalar_one_or_none()

    if not account or not verify_password(data.password, account.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Student ID or password.",
        )

    account.last_login = ph_now()
    await db.commit()

    token = create_access_token({"sub": account.id, "role": "student"})
    return {"access_token": token, "token_type": "bearer"}
