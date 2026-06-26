from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, delete as sql_delete, func, cast, Date
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
import logging

from app.db.session import get_db
from app.models.models import Attendance, Student, NotificationLog
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
    time_in: Optional[str] = None  # HH:MM - if provided, overrides the recorded time


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


@router.get("/by-date")
async def get_attendance_by_date(
    date: Optional[str] = Query(None, description="YYYY-MM-DD - omit for today"),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    """Get attendance records for a specific date (admin). Defaults to today (PH time)."""
    if date:
        target = datetime.strptime(date, "%Y-%m-%d")
    else:
        t = ph_now().date()
        target = datetime(t.year, t.month, t.day)

    day_start = datetime(target.year, target.month, target.day, 0, 0, 0)
    day_end = datetime(target.year, target.month, target.day, 23, 59, 59, 999999)

    result = await db.execute(
        select(Attendance, Student)
        .join(Student, Attendance.student_id == Student.id)
        .where(and_(Attendance.date >= day_start, Attendance.date <= day_end))
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


@router.get("/activity")
async def get_attendance_activity(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    """Return record counts grouped by date for the activity heatmap."""
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
    result = await db.execute(
        select(
            cast(Attendance.date, Date).label("day"),
            func.count().label("count"),
        )
        .where(and_(Attendance.date >= start, Attendance.date <= end))
        .group_by(cast(Attendance.date, Date))
    )
    return {str(row.day): row.count for row in result.all()}


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

    corrected_time_in = None
    if payload.time_in:
        h, m = map(int, payload.time_in.split(":"))
        corrected_time_in = datetime(target_date.year, target_date.month, target_date.day, h, m)

    if record:
        record.status = payload.status
        record.is_manual_override = True
        record.notes = payload.notes
        if corrected_time_in:
            record.time_in = corrected_time_in
    else:
        record = Attendance(
            student_id=student.id,
            date=target_date,
            time_in=corrected_time_in or target_date,
            status=payload.status,
            is_manual_override=True,
            notes=payload.notes,
        )
        db.add(record)

    await db.commit()
    return {"message": f"Attendance updated to '{payload.status}' for {payload.student_id} on {payload.date}."}


@router.delete("/")
async def clear_attendance(
    date: Optional[str] = Query(None, description="YYYY-MM-DD - clear only this date; omit to clear all"),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    """DEV: Delete attendance records. Pass ?date=YYYY-MM-DD to clear one day, or omit to clear all."""
    if date:
        target = datetime.strptime(date, "%Y-%m-%d")
        day_start = datetime(target.year, target.month, target.day, 0, 0, 0)
        day_end = datetime(target.year, target.month, target.day, 23, 59, 59, 999999)
        id_result = await db.execute(
            select(Attendance.id).where(and_(Attendance.date >= day_start, Attendance.date <= day_end))
        )
        stmt = sql_delete(Attendance).where(
            and_(Attendance.date >= day_start, Attendance.date <= day_end)
        )
    else:
        id_result = await db.execute(select(Attendance.id))
        stmt = sql_delete(Attendance)

    att_ids = [row[0] for row in id_result.all()]
    if att_ids:
        await db.execute(
            sql_delete(NotificationLog).where(NotificationLog.attendance_id.in_(att_ids))
        )

    result = await db.execute(stmt)
    await db.commit()
    return {"deleted": result.rowcount}
