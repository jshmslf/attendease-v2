from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel
from typing import List

from app.db.session import get_db
from app.core.security import get_current_admin
from app.models.models import Section

router = APIRouter()


class SectionIn(BaseModel):
    name: str

class SectionOut(BaseModel):
    id: str
    name: str
    created_at: str

    class Config:
        from_attributes = True


@router.get("/", response_model=List[SectionOut])
async def list_sections(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    result = await db.execute(select(Section).order_by(Section.name))
    sections = result.scalars().all()
    return [SectionOut(id=s.id, name=s.name, created_at=s.created_at.isoformat()) for s in sections]


@router.post("/", response_model=SectionOut, status_code=status.HTTP_201_CREATED)
async def create_section(
    body: SectionIn,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    existing = await db.execute(select(Section).where(Section.name == body.name.strip()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Section name already exists.")

    section = Section(name=body.name.strip())
    db.add(section)
    await db.commit()
    await db.refresh(section)
    return SectionOut(id=section.id, name=section.name, created_at=section.created_at.isoformat())


@router.put("/{section_id}", response_model=SectionOut)
async def update_section(
    section_id: str,
    body: SectionIn,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    result = await db.execute(select(Section).where(Section.id == section_id))
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found.")

    # Check name uniqueness if changed
    if body.name.strip() != section.name:
        existing = await db.execute(
            select(Section).where(
                and_(Section.name == body.name.strip(), Section.id != section_id)
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Section name already exists.")

    section.name = body.name.strip()
    await db.commit()
    await db.refresh(section)
    return SectionOut(id=section.id, name=section.name, created_at=section.created_at.isoformat())


@router.delete("/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_section(
    section_id: str,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    result = await db.execute(select(Section).where(Section.id == section_id))
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found.")
    await db.delete(section)
    await db.commit()
