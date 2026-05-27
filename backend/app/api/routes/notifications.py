from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, delete as sql_delete

from app.db.session import get_db
from app.models.models import NotificationLog, Parent, Student
from app.core.security import get_current_admin

router = APIRouter()


@router.get("/")
async def list_notifications(
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin),
):
    """List recent parent notification logs (admin only)."""
    result = await db.execute(
        select(NotificationLog, Parent, Student)
        .join(Parent, NotificationLog.parent_id == Parent.id)
        .join(Student, Parent.student_id == Student.id)
        .order_by(desc(NotificationLog.created_at))
        .limit(limit)
    )
    rows = result.all()

    return [
        {
            "id": log.id,
            "student_name": f"{stu.first_name} {stu.last_name}",
            "student_id": stu.student_id,
            "parent_name": par.name,
            "phone_number": par.phone_number,
            "message": log.message,
            "status": log.status,
            "sent_at": log.sent_at.isoformat() if log.sent_at else None,
            "created_at": log.created_at.isoformat(),
        }
        for log, par, stu in rows
    ]


@router.delete("/")
async def clear_notifications(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_admin),
):
    """Delete all notification log records."""
    result = await db.execute(sql_delete(NotificationLog))
    await db.commit()
    return {"deleted": result.rowcount}
