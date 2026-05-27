from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from datetime import time
from typing import List, Optional

from app.db.session import get_db
from app.core.security import get_current_admin, get_current_student
from app.models.models import Subject, SubjectSchedule, StudentSubject, Student

router = APIRouter()

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


# ── Pydantic schemas ────────────────────────────────────────────────────────

class ScheduleIn(BaseModel):
    day_of_week: int        # 0=Monday, 6=Sunday
    start_time: str         # "HH:MM"
    end_time: Optional[str] = None   # "HH:MM"
    room: Optional[str] = None

class SubjectIn(BaseModel):
    subject_code: str
    name: str
    teacher: str
    schedules: List[ScheduleIn] = []

class ScheduleOut(BaseModel):
    id: str
    day_of_week: int
    start_time: str
    end_time: Optional[str] = None
    room: Optional[str] = None

    class Config:
        from_attributes = True

class SubjectOut(BaseModel):
    id: str
    subject_code: str
    name: str
    teacher: str
    schedules: List[ScheduleOut]
    student_count: int = 0

    class Config:
        from_attributes = True

class StudentOut(BaseModel):
    id: str
    student_id: str
    first_name: str
    last_name: str
    email: str
    course: str
    year_level: int
    has_face_enrolled: bool = False
    is_active: bool = True

    class Config:
        from_attributes = True

class AssignStudentIn(BaseModel):
    student_id: str


# ── Helpers ─────────────────────────────────────────────────────────────────

def parse_time(t: str) -> time:
    """Parse 'HH:MM' or 'HH:MM:SS' into a Python time object."""
    parts = t.strip().split(":")
    return time(int(parts[0]), int(parts[1]))


def format_time(t: time) -> str:
    return t.strftime("%H:%M")


def subject_to_out(subject: Subject, student_count: int = 0) -> SubjectOut:
    return SubjectOut(
        id=subject.id,
        subject_code=subject.subject_code,
        name=subject.name,
        teacher=subject.teacher,
        schedules=[
            ScheduleOut(
                id=s.id,
                day_of_week=s.day_of_week,
                start_time=format_time(s.start_time),
                end_time=format_time(s.end_time) if s.end_time else None,
                room=s.room,
            )
            for s in sorted(subject.schedules, key=lambda s: (s.day_of_week, s.start_time))
        ],
        student_count=student_count,
    )


# ── Routes ──────────────────────────────────────────────────────────────────

@router.get("/my", response_model=List[SubjectOut])
async def get_my_subjects(
    db: AsyncSession = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    """Student portal: list subjects assigned to the current student."""
    result = await db.execute(
        select(Subject)
        .options(selectinload(Subject.schedules))
        .join(StudentSubject, StudentSubject.subject_id == Subject.id)
        .where(StudentSubject.student_id == current_student.id)
        .order_by(Subject.subject_code)
    )
    subjects = result.scalars().all()
    return [subject_to_out(s) for s in subjects]


@router.get("/by-student/{student_id}", response_model=List[SubjectOut])
async def list_student_subjects(
    student_id: str,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """List all subjects assigned to a specific student."""
    result = await db.execute(
        select(Subject)
        .options(selectinload(Subject.schedules))
        .join(StudentSubject, StudentSubject.subject_id == Subject.id)
        .where(StudentSubject.student_id == student_id)
        .order_by(Subject.subject_code)
    )
    subjects = result.scalars().all()
    return [subject_to_out(s) for s in subjects]


@router.get("/", response_model=List[SubjectOut])
async def list_subjects(
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    result = await db.execute(
        select(Subject).options(selectinload(Subject.schedules)).order_by(Subject.subject_code)
    )
    subjects = result.scalars().all()

    # Count enrolled students per subject
    count_result = await db.execute(
        select(StudentSubject.subject_id, func.count(StudentSubject.id).label("cnt"))
        .group_by(StudentSubject.subject_id)
    )
    counts = {row.subject_id: row.cnt for row in count_result}

    return [subject_to_out(s, counts.get(s.id, 0)) for s in subjects]


@router.post("/", response_model=SubjectOut, status_code=status.HTTP_201_CREATED)
async def create_subject(
    body: SubjectIn,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    existing = await db.execute(
        select(Subject).where(Subject.subject_code == body.subject_code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Subject code already exists.")

    subject = Subject(
        subject_code=body.subject_code.strip().upper(),
        name=body.name.strip(),
        teacher=body.teacher.strip(),
    )
    db.add(subject)
    await db.flush()

    for sched in body.schedules:
        db.add(SubjectSchedule(
            subject_id=subject.id,
            day_of_week=sched.day_of_week,
            start_time=parse_time(sched.start_time),
            end_time=parse_time(sched.end_time) if sched.end_time else None,
            room=sched.room.strip() if sched.room else None,
        ))

    await db.commit()
    await db.refresh(subject)
    # Reload with schedules eagerly loaded
    result = await db.execute(
        select(Subject).options(selectinload(Subject.schedules)).where(Subject.id == subject.id)
    )
    subject = result.scalar_one()
    return subject_to_out(subject)


@router.get("/{subject_id}", response_model=SubjectOut)
async def get_subject(
    subject_id: str,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    result = await db.execute(
        select(Subject).options(selectinload(Subject.schedules)).where(Subject.id == subject_id)
    )
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    count_result = await db.execute(
        select(func.count(StudentSubject.id)).where(StudentSubject.subject_id == subject_id)
    )
    count = count_result.scalar_one() or 0
    return subject_to_out(subject, count)


@router.put("/{subject_id}", response_model=SubjectOut)
async def update_subject(
    subject_id: str,
    body: SubjectIn,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    result = await db.execute(
        select(Subject).options(selectinload(Subject.schedules)).where(Subject.id == subject_id)
    )
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    # Check code uniqueness if changed
    if body.subject_code.upper() != subject.subject_code:
        existing = await db.execute(
            select(Subject).where(
                and_(Subject.subject_code == body.subject_code.upper(), Subject.id != subject_id)
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Subject code already exists.")

    subject.subject_code = body.subject_code.strip().upper()
    subject.name = body.name.strip()
    subject.teacher = body.teacher.strip()

    # Replace schedules
    await db.execute(
        SubjectSchedule.__table__.delete().where(SubjectSchedule.subject_id == subject_id)
    )
    for sched in body.schedules:
        db.add(SubjectSchedule(
            subject_id=subject.id,
            day_of_week=sched.day_of_week,
            start_time=parse_time(sched.start_time),
            end_time=parse_time(sched.end_time) if sched.end_time else None,
            room=sched.room.strip() if sched.room else None,
        ))

    await db.commit()

    reloaded = await db.execute(
        select(Subject).options(selectinload(Subject.schedules)).where(Subject.id == subject_id)
    )
    subject = reloaded.scalar_one()

    count_result = await db.execute(
        select(func.count(StudentSubject.id)).where(StudentSubject.subject_id == subject_id)
    )
    count = count_result.scalar_one() or 0
    return subject_to_out(subject, count)


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject(
    subject_id: str,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")
    await db.delete(subject)
    await db.commit()


@router.get("/{subject_id}/students", response_model=List[StudentOut])
async def list_subject_students(
    subject_id: str,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Subject not found.")

    students_result = await db.execute(
        select(Student)
        .join(StudentSubject, StudentSubject.student_id == Student.id)
        .where(StudentSubject.subject_id == subject_id)
        .order_by(Student.last_name)
    )
    students = students_result.scalars().all()
    return [
        StudentOut(
            id=s.id,
            student_id=s.student_id,
            first_name=s.first_name,
            last_name=s.last_name,
            email=s.email,
            course=s.course,
            year_level=s.year_level,
            has_face_enrolled=bool(s.face_encoding),
            is_active=s.is_active,
        )
        for s in students
    ]


@router.post("/{subject_id}/students", status_code=status.HTTP_201_CREATED)
async def assign_student(
    subject_id: str,
    body: AssignStudentIn,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Subject not found.")

    student_result = await db.execute(select(Student).where(Student.id == body.student_id))
    if not student_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Student not found.")

    existing = await db.execute(
        select(StudentSubject).where(
            and_(
                StudentSubject.student_id == body.student_id,
                StudentSubject.subject_id == subject_id,
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Student already assigned to this subject.")

    db.add(StudentSubject(student_id=body.student_id, subject_id=subject_id))
    await db.commit()
    return {"message": "Student assigned."}


@router.delete("/{subject_id}/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unassign_student(
    subject_id: str,
    student_id: str,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    result = await db.execute(
        select(StudentSubject).where(
            and_(
                StudentSubject.student_id == student_id,
                StudentSubject.subject_id == subject_id,
            )
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    await db.delete(assignment)
    await db.commit()
