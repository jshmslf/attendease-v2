from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, case
from datetime import datetime
import logging

from app.models.models import Attendance, Student, Parent, NotificationLog, SubjectSchedule, StudentSubject, AppSettings
from app.services.sms_service import send_sms_notification
from app.core.config import settings
from app.core.timezone import ph_now

logger = logging.getLogger(__name__)


async def is_already_marked_today(student_id: str, db: AsyncSession) -> bool:
    """Check if student already has attendance for today (PH time)."""
    today = ph_now().date()
    today_start = datetime(today.year, today.month, today.day, 0, 0, 0)
    today_end = datetime(today.year, today.month, today.day, 23, 59, 59, 999999)

    result = await db.execute(
        select(Attendance).where(
            and_(
                Attendance.student_id == student_id,
                Attendance.date >= today_start,
                Attendance.date <= today_end,
            )
        )
    )
    return result.scalar_one_or_none() is not None


async def determine_status(db: AsyncSession, student_id: str, time_in: datetime) -> str:
    """
    Determine present/late based on the student's subject schedule for today.
    Uses the earliest class start time on the given day as the threshold.
    Falls back to the global LATE_THRESHOLD_HOUR if no schedule exists for today.
    """
    day_of_week = time_in.weekday()  # 0=Monday, 6=Sunday

    result = await db.execute(
        select(func.min(SubjectSchedule.start_time)).where(
            and_(
                SubjectSchedule.day_of_week == day_of_week,
                SubjectSchedule.subject_id.in_(
                    select(StudentSubject.subject_id).where(
                        StudentSubject.student_id == student_id
                    )
                )
            )
        )
    )
    earliest = result.scalar_one_or_none()

    if earliest is not None:
        return "late" if time_in.time() >= earliest else "present"

    # No subjects scheduled for today → fall back to global threshold
    return "late" if time_in.hour >= settings.LATE_THRESHOLD_HOUR else "present"


async def mark_attendance(
    student: Student,
    confidence_score: float,
    camera_id: str,
    db: AsyncSession,
) -> Attendance | None:
    """
    Core attendance marking function.
    - Prevents duplicate entries for the same day.
    - Determines present/late status.
    - Triggers SMS notification asynchronously.
    """
    if await is_already_marked_today(student.id, db):
        logger.info(f"Student {student.student_id} already marked today. Skipping.")
        return None

    now = ph_now()
    status = await determine_status(db, student.id, now)

    attendance = Attendance(
        student_id=student.id,
        date=now,
        time_in=now,
        confidence_score=confidence_score,
        camera_id=camera_id,
        status=status,
    )
    db.add(attendance)
    await db.commit()
    await db.refresh(attendance)

    logger.info(
        f"Attendance marked: {student.student_id} | "
        f"Status: {status} | Confidence: {confidence_score:.2f}"
    )

    # Trigger SMS notifications to all active parents
    await notify_parents(student, attendance, db)

    return attendance


async def notify_parents(
    student: Student,
    attendance: Attendance,
    db: AsyncSession,
):
    """Send SMS to all registered parents of the student."""
    result = await db.execute(
        select(Parent).where(
            and_(
                Parent.student_id == student.id,
                Parent.is_active == True
            )
        )
    )
    parents = result.scalars().all()

    if not parents:
        logger.warning(f"No active parents found for student {student.student_id}")
        return

    settings_row = (await db.execute(select(AppSettings).limit(1))).scalar_one_or_none()
    school_name = settings_row.school_name if settings_row else "AttendEase"

    time_str = attendance.time_in.strftime("%I:%M %p")
    status_text = "present" if attendance.status == "present" else "late"
    student_name = f"{student.first_name} {student.last_name}"

    for parent in parents:
        message = (
            f"Hello Ms/Mr {parent.name}! {student_name} has been marked "
            f"{status_text} at {time_str} today! - {school_name}"
        )
        log = NotificationLog(
            parent_id=parent.id,
            attendance_id=attendance.id,
            message=message,
            status="pending",
        )
        db.add(log)
        await db.commit()
        await db.refresh(log)

        # Send SMS (uses Celery task in production, direct call here for simplicity)
        success, error = await send_sms_notification(parent.phone_number, message)

        log.status = "sent" if success else "failed"
        log.sent_at = ph_now() if success else None
        log.error_message = error
        await db.commit()


async def get_attendance_summary(student_id: str, db: AsyncSession) -> dict:
    """Get attendance stats for student portal."""
    result = await db.execute(
        select(
            func.count(Attendance.id).label("total"),
            func.sum(case((Attendance.status == "present", 1), else_=0)).label("present_count"),
            func.sum(case((Attendance.status == "late", 1), else_=0)).label("late_count"),
        ).where(Attendance.student_id == student_id)
    )
    row = result.one()

    total = row.total or 0
    present = row.present_count or 0
    late = row.late_count or 0
    attendance_rate = round((present + late) / total * 100, 1) if total > 0 else 0

    return {
        "total_school_days": total,
        "present": present,
        "late": late,
        "absent": total - present - late,
        "attendance_rate": attendance_rate,
    }
