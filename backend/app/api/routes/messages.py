import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.db.session import get_db
from app.models.models import StudentMessage, Student
from app.core.security import get_current_admin, get_current_student

router = APIRouter()

# WebSocket connections for real-time message badge updates
message_connections: list[WebSocket] = []


async def _unread_count(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count(StudentMessage.id)).where(StudentMessage.is_read == False)
    )
    return result.scalar_one() or 0


async def broadcast_message_event(payload: dict):
    dead = []
    for ws in message_connections:
        try:
            await ws.send_json(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        message_connections.remove(ws)


class MessageCreate(BaseModel):
    body: str


class MessageResponse(BaseModel):
    id: str
    student_id: str
    student_name: str
    body: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


@router.websocket("/ws")
async def messages_ws(websocket: WebSocket):
    """Admin: real-time message event stream for the unread badge."""
    await websocket.accept()
    message_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in message_connections:
            message_connections.remove(websocket)


@router.post("/", response_model=MessageResponse)
async def send_message(
    data: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    """Student portal: send a support message to admin."""
    msg = StudentMessage(
        id=str(uuid.uuid4()),
        student_id=current_student.id,
        body=data.body,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    count = await _unread_count(db)
    await broadcast_message_event({"type": "new_message", "unread_count": count})

    return {
        **msg.__dict__,
        "student_name": f"{current_student.first_name} {current_student.last_name}",
        "student_id": current_student.student_id,
    }


@router.get("/unread-count")
async def unread_count(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    """Admin: count unread student messages."""
    return {"count": await _unread_count(db)}


@router.get("/", response_model=list[MessageResponse])
async def list_messages(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    """Admin: list all student support messages, newest first."""
    result = await db.execute(
        select(StudentMessage, Student)
        .join(Student, StudentMessage.student_id == Student.id)
        .order_by(StudentMessage.created_at.desc())
    )
    rows = result.all()
    return [
        {
            **msg.__dict__,
            "student_name": f"{s.first_name} {s.last_name}",
            "student_id": s.student_id,
        }
        for msg, s in rows
    ]


@router.put("/{message_id}/read")
async def mark_read(
    message_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    """Admin: mark a message as read."""
    result = await db.execute(select(StudentMessage).where(StudentMessage.id == message_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")
    msg.is_read = True
    await db.commit()

    count = await _unread_count(db)
    await broadcast_message_event({"type": "read_update", "unread_count": count})

    return {"message": "Marked as read."}
