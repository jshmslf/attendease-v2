from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update
from pydantic import BaseModel
from typing import List

from app.db.session import get_db
from app.core.security import get_current_admin
from app.models.models import Course, Student

router = APIRouter()


class CourseIn(BaseModel):
    name: str

class CourseOut(BaseModel):
    id: str
    name: str
    created_at: str

    class Config:
        from_attributes = True


@router.get("/", response_model=List[CourseOut])
async def list_courses(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    result = await db.execute(select(Course).order_by(Course.name))
    courses = result.scalars().all()
    return [CourseOut(id=c.id, name=c.name, created_at=c.created_at.isoformat()) for c in courses]


@router.post("/", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
async def create_course(
    body: CourseIn,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    existing = await db.execute(select(Course).where(Course.name == body.name.strip()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Course name already exists.")

    course = Course(name=body.name.strip())
    db.add(course)
    await db.commit()
    await db.refresh(course)
    return CourseOut(id=course.id, name=course.name, created_at=course.created_at.isoformat())


@router.put("/{course_id}", response_model=CourseOut)
async def update_course(
    course_id: str,
    body: CourseIn,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")

    new_name = body.name.strip()
    if new_name != course.name:
        existing = await db.execute(
            select(Course).where(and_(Course.name == new_name, Course.id != course_id))
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Course name already exists.")

        await db.execute(
            update(Student).where(Student.course == course.name).values(course=new_name)
        )

    course.name = new_name
    await db.commit()
    await db.refresh(course)
    return CourseOut(id=course.id, name=course.name, created_at=course.created_at.isoformat())


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(
    course_id: str,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    await db.delete(course)
    await db.commit()
