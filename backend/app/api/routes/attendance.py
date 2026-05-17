from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, delete as sql_delete
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
import logging

from app.db.session import get_db
from app.models.models import Attendance, Student
from app.services.attendance_service import get_attendance_summary
from app.core.security import get_current_admin, get_current_student
from app.core.timezone import ph_now

router = APIRouter()
logger = logging.getLogger(__name__)


class ManualOverrideRequest(BaseModel):
    student_id: str
    date: str            # YYYY-MM-DD
    status: str          # present, late, absent
    notes: Optional[str] = None


@router.get("/today")
async def get_today_attendance(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    """Get all attendance records for today (admin dashboard), using PH time."""
    today = ph_now().date()
    today_start = datetime(today.year, today.month, today.day, 0, 0, 0)
    today_end = datetime(today.year, today.month, today.day, 23, 59, 59, 999999)

    result = await db.execute(
        select(Attendance, Student)
        .join(Student, Attendance.student_id == Student.id)
        .where(
            and_(
                Attendance.date >= today_start,
                Attendance.date <= today_end,
            )
        )
        .order_by(desc(Attendance.time_in))
    )

    rows = result.all()
    return [
        {
            "id": att.id,
            "student_id": stu.student_id,
            "student_name": f"{stu.first_name} {stu.last_name}",
            "course": stu.course,
            "year_level": stu.year_level,
            "time_in": att.time_in.isoformat(),
            "status": att.status,
            "confidence_score": att.confidence_score,
            "camera_id": att.camera_id,
            "is_manual_override": att.is_manual_override,
        }
        for att, stu in rows
    ]


@router.get("/student/me")
async def get_my_attendance(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    """Student portal: view own attendance records."""
    query = select(Attendance).where(
        Attendance.student_id == current_student.id
    )

    if month and year:
        start = datetime(year, month, 1)
        end = datetime(year, month + 1, 1) if month < 12 else datetime(year + 1, 1, 1)
        query = query.where(
            and_(Attendance.date >= start, Attendance.date < end)
        )

    query = query.order_by(desc(Attendance.date))
    result = await db.execute(query)
    records = result.scalars().all()

    summary = await get_attendance_summary(current_student.id, db)

    return {
        "summary": summary,
        "records": [
            {
                "id": r.id,
                "date": r.date.strftime("%B %d, %Y"),
                "time_in": r.time_in.strftime("%I:%M %p"),
                "status": r.status,
                "confidence_score": r.confidence_score,
            }
            for r in records
        ],
    }


@router.post("/override")
async def manual_override(
    payload: ManualOverrideRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    """Admin manual override for attendance record."""
    result = await db.execute(
        select(Student).where(Student.student_id == payload.student_id)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    target_date = datetime.strptime(payload.date, "%Y-%m-%d")

    # Check existing record
    existing = await db.execute(
        select(Attendance).where(
            and_(
                Attendance.student_id == student.id,
                Attendance.date >= target_date,
                Attendance.date < datetime(target_date.year, target_date.month, target_date.day + 1),
            )
        )
    )
    record = existing.scalar_one_or_none()

    if record:
        record.status = payload.status
        record.is_manual_override = True
        record.notes = payload.notes
    else:
        record = Attendance(
            student_id=student.id,
            date=target_date,
            time_in=target_date,
            status=payload.status,
            is_manual_override=True,
            notes=payload.notes,
        )
        db.add(record)

    await db.commit()
    return {"message": f"Attendance updated to '{payload.status}' for {payload.student_id} on {payload.date}."}


@router.delete("/")
async def clear_attendance(
    date: Optional[str] = Query(None, description="YYYY-MM-DD — clear only this date; omit to clear all"),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    """DEV: Delete attendance records. Pass ?date=YYYY-MM-DD to clear one day, or omit to clear all."""
    if date:
        target = datetime.strptime(date, "%Y-%m-%d")
        day_start = datetime(target.year, target.month, target.day, 0, 0, 0)
        day_end = datetime(target.year, target.month, target.day, 23, 59, 59, 999999)
        stmt = sql_delete(Attendance).where(
            and_(Attendance.date >= day_start, Attendance.date <= day_end)
        )
    else:
        stmt = sql_delete(Attendance)
    result = await db.execute(stmt)
    await db.commit()
    return {"deleted": result.rowcount}
