from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import asyncio
import logging

from app.db.session import get_db
from app.services.face_service import recognize_all_faces_from_frame
from app.services.attendance_service import mark_attendance
from app.core.security import verify_api_key, get_current_admin
from app.core.timezone import ph_now

router = APIRouter()
logger = logging.getLogger(__name__)

# Track active WebSocket connections for real-time dashboard updates
active_connections: list[WebSocket] = []

# Last time the camera gateway successfully posted a frame
gateway_last_seen: Optional[datetime] = None
GATEWAY_TIMEOUT_SECONDS = 6  # 3× the 2-second recognition interval


class FrameRequest(BaseModel):
    frame_b64: str       # Base64-encoded JPEG frame from camera
    camera_id: str       # e.g. "main-gate"


class RecognitionResult(BaseModel):
    recognized: bool
    student_id: str | None = None
    student_name: str | None = None
    confidence: float = 0.0
    attendance_marked: bool = False
    already_marked_today: bool = False
    status: str | None = None  # present, late
    face_location: list[int] | None = None


@router.post("/recognize", response_model=list[RecognitionResult])
async def recognize_frame(
    payload: FrameRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_api_key),
):
    """
    Main endpoint called by the camera gateway.
    Accepts a base64 frame, runs multi-face recognition,
    marks attendance for each matched face, and broadcasts WS updates.
    Returns a list of per-face results.
    """
    global gateway_last_seen
    gateway_last_seen = ph_now()

    face_results = await recognize_all_faces_from_frame(payload.frame_b64, db)

    if not face_results:
        return []

    output = []
    for r in face_results:
        student = r["student"]
        confidence = r["confidence"]
        face_location = list(r["face_location"])

        if student is None:
            output.append(RecognitionResult(
                recognized=False,
                confidence=round(confidence, 3),
                face_location=face_location,
            ))
            continue

        attendance = await mark_attendance(
            student=student,
            confidence_score=confidence,
            camera_id=payload.camera_id,
            db=db,
        )
        already_marked = attendance is None

        await broadcast_update({
            "type": "attendance_update",
            "student_id": student.student_id,
            "student_name": f"{student.first_name} {student.last_name}",
            "confidence": round(confidence, 3),
            "status": attendance.status if attendance else "already_marked",
            "already_marked": already_marked,
        })

        output.append(RecognitionResult(
            recognized=True,
            student_id=student.student_id,
            student_name=f"{student.first_name} {student.last_name}",
            confidence=round(confidence, 3),
            attendance_marked=not already_marked,
            already_marked_today=already_marked,
            status=attendance.status if attendance else None,
            face_location=face_location,
        ))

    return output


@router.get("/status")
async def gateway_status(_: None = Depends(get_current_admin)):
    """Returns whether the camera gateway is actively sending frames."""
    if gateway_last_seen is None:
        return {"live": False, "last_seen": None, "seconds_ago": None}
    seconds_ago = (ph_now() - gateway_last_seen).total_seconds()
    return {
        "live": seconds_ago <= GATEWAY_TIMEOUT_SECONDS,
        "last_seen": gateway_last_seen.isoformat(),
        "seconds_ago": round(seconds_ago, 1),
    }


@router.websocket("/ws/live")
async def websocket_live_feed(websocket: WebSocket):
    """
    WebSocket endpoint for the admin dashboard to receive
    real-time attendance updates as students pass through.
    """
    await websocket.accept()
    active_connections.append(websocket)
    logger.info(f"Dashboard connected. Total connections: {len(active_connections)}")

    try:
        while True:
            await asyncio.sleep(30)
            try:
                await websocket.send_json({"type": "ping"})
            except Exception:
                break
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in active_connections:
            active_connections.remove(websocket)
        logger.info(f"Dashboard disconnected. Total connections: {len(active_connections)}")


async def broadcast_update(data: dict):
    """Send update to all connected dashboard clients."""
    disconnected = []
    for connection in active_connections:
        try:
            await connection.send_json(data)
        except Exception:
            disconnected.append(connection)

    for conn in disconnected:
        active_connections.remove(conn)
