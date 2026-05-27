from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.db.session import get_db
from app.models.models import AppSettings
from app.core.security import get_current_admin

router = APIRouter()


class SettingsOut(BaseModel):
    school_name: str

    class Config:
        from_attributes = True


class SettingsIn(BaseModel):
    school_name: str


@router.get("/", response_model=SettingsOut)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin),
):
    result = await db.execute(select(AppSettings).limit(1))
    row = result.scalar_one_or_none()
    if not row:
        row = AppSettings(school_name="AttendEase")
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


@router.put("/", response_model=SettingsOut)
async def update_settings(
    body: SettingsIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin),
):
    result = await db.execute(select(AppSettings).limit(1))
    row = result.scalar_one_or_none()
    if not row:
        row = AppSettings(school_name=body.school_name.strip())
        db.add(row)
    else:
        row.school_name = body.school_name.strip()
    await db.commit()
    await db.refresh(row)
    return row
