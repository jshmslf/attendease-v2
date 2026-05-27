import face_recognition
import numpy as np
import cv2
import json
import base64
from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

from app.models.models import Student, Attendance
from app.core.config import settings

logger = logging.getLogger(__name__)


def encode_face_array(encoding: np.ndarray) -> str:
    """Serialize numpy face encoding to JSON string for DB storage."""
    return json.dumps(encoding.tolist())


def decode_face_array(encoding_str: str) -> np.ndarray:
    """Deserialize JSON string back to numpy face encoding."""
    return np.array(json.loads(encoding_str))


def extract_encoding_from_image(image_bytes: bytes) -> Optional[np.ndarray]:
    """
    Extract face encoding from raw image bytes.
    Returns None if no face detected or multiple faces found.
    """
    np_array = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(np_array, cv2.IMREAD_COLOR)
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    face_locations = face_recognition.face_locations(rgb_image, model="hog")

    if len(face_locations) == 0:
        logger.warning("No face detected in image.")
        return None

    if len(face_locations) > 1:
        logger.warning(f"Multiple faces detected ({len(face_locations)}). Using first.")

    encodings = face_recognition.face_encodings(rgb_image, face_locations)
    return encodings[0] if encodings else None


def extract_encoding_from_base64(image_b64: str) -> Optional[np.ndarray]:
    """Extract face encoding from a base64-encoded image string."""
    image_bytes = base64.b64decode(image_b64)
    return extract_encoding_from_image(image_bytes)


async def recognize_face_from_frame(
    frame_b64: str,
    db: AsyncSession,
) -> Tuple[Optional[Student], float]:
    """
    Main recognition pipeline:
    1. Decode frame
    2. Extract face encoding
    3. Compare against all enrolled students
    4. Return best match above threshold

    Returns (Student, confidence) or (None, 0.0)
    """
    unknown_encoding = extract_encoding_from_base64(frame_b64)
    if unknown_encoding is None:
        return None, 0.0

    # Load all active students with face encodings
    result = await db.execute(
        select(Student).where(
            Student.is_active == True,
            Student.face_encoding != None
        )
    )
    students = result.scalars().all()

    if not students:
        logger.warning("No enrolled students with face encodings found.")
        return None, 0.0

    known_encodings = []
    for student in students:
        try:
            enc = decode_face_array(student.face_encoding)
            known_encodings.append((student, enc))
        except Exception as e:
            logger.error(f"Failed to decode encoding for student {student.student_id}: {e}")

    if not known_encodings:
        return None, 0.0

    # Compare unknown face against all known encodings
    encodings_only = [e for _, e in known_encodings]
    distances = face_recognition.face_distance(encodings_only, unknown_encoding)

    best_idx = int(np.argmin(distances))
    best_distance = float(distances[best_idx])
    confidence = 1.0 - best_distance  # Convert distance to confidence score

    if confidence >= settings.FACE_MATCH_THRESHOLD:
        matched_student = known_encodings[best_idx][0]
        logger.info(
            f"Face matched: {matched_student.student_id} "
            f"(confidence: {confidence:.2f})"
        )
        return matched_student, confidence

    logger.info(f"No match above threshold. Best confidence: {confidence:.2f}")
    return None, confidence


def extract_all_faces_from_image(image_bytes: bytes) -> list[tuple[np.ndarray, tuple]]:
    """
    Detect ALL faces in image and return their encodings + bounding boxes.
    Returns list of (encoding, (top, right, bottom, left)) - empty if none found.
    """
    np_array = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(np_array, cv2.IMREAD_COLOR)
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    face_locations = face_recognition.face_locations(rgb_image, model="hog")
    if not face_locations:
        return []

    encodings = face_recognition.face_encodings(rgb_image, face_locations)
    return list(zip(encodings, face_locations))


async def recognize_all_faces_from_frame(
    frame_b64: str,
    db: AsyncSession,
) -> list[dict]:
    """
    Multi-face recognition pipeline.
    Detects all faces in the frame and matches each against enrolled students.
    Returns a list of per-face dicts with keys: student, confidence, face_location.
    """
    image_bytes = base64.b64decode(frame_b64)
    face_data = extract_all_faces_from_image(image_bytes)

    if not face_data:
        return []

    result = await db.execute(
        select(Student).where(
            Student.is_active == True,
            Student.face_encoding != None,
        )
    )
    students = result.scalars().all()

    if not students:
        return [{"student": None, "confidence": 0.0, "face_location": loc} for _, loc in face_data]

    known_encodings = []
    for student in students:
        try:
            enc = decode_face_array(student.face_encoding)
            known_encodings.append((student, enc))
        except Exception as e:
            logger.error(f"Failed to decode encoding for {student.student_id}: {e}")

    if not known_encodings:
        return [{"student": None, "confidence": 0.0, "face_location": loc} for _, loc in face_data]

    encodings_only = [e for _, e in known_encodings]
    results = []

    for unknown_encoding, face_location in face_data:
        distances = face_recognition.face_distance(encodings_only, unknown_encoding)
        best_idx = int(np.argmin(distances))
        best_distance = float(distances[best_idx])
        confidence = 1.0 - best_distance

        if confidence >= settings.FACE_MATCH_THRESHOLD:
            matched_student = known_encodings[best_idx][0]
            logger.info(f"Face matched: {matched_student.student_id} (confidence: {confidence:.2f})")
            results.append({"student": matched_student, "confidence": confidence, "face_location": face_location})
        else:
            logger.info(f"No match above threshold. Best confidence: {confidence:.2f}")
            results.append({"student": None, "confidence": confidence, "face_location": face_location})

    return results


def draw_recognition_result(
    frame: np.ndarray,
    name: str,
    confidence: float,
    face_location: Tuple,
    matched: bool
) -> np.ndarray:
    """Draw bounding box and label on frame for display."""
    top, right, bottom, left = face_location
    color = (0, 255, 0) if matched else (0, 0, 255)  # Green=match, Red=unknown

    cv2.rectangle(frame, (left, top), (right, bottom), color, 2)
    label = f"{name} ({confidence:.0%})" if matched else "Unknown"
    cv2.putText(
        frame, label,
        (left, top - 10),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6, color, 2
    )
    return frame


async def save_face_image(student_internal_id: str, image_bytes: bytes) -> str:
    """
    Save an uploaded face photo to local filesystem.
    Path: {LOCAL_STORAGE_PATH}/{student_internal_id}/photo_{n:03d}.jpg
    Returns the relative path of the saved file.
    """
    import os
    import aiofiles

    dir_path = os.path.join(settings.LOCAL_STORAGE_PATH, student_internal_id)
    os.makedirs(dir_path, exist_ok=True)

    existing = [f for f in os.listdir(dir_path) if f.startswith("photo_")]
    next_n = len(existing) + 1
    filename = f"photo_{next_n:03d}.jpg"
    file_path = os.path.join(dir_path, filename)

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(image_bytes)

    return f"{settings.LOCAL_STORAGE_PATH}/{student_internal_id}/{filename}"


def retrain_student_encoding(student_internal_id: str) -> Optional[np.ndarray]:
    """
    Load all stored photos for a student and compute an averaged face encoding.
    Averaging multiple angles improves recognition accuracy.
    Returns the averaged encoding, or None if no valid faces found.
    """
    import os

    dir_path = os.path.join(settings.LOCAL_STORAGE_PATH, student_internal_id)
    if not os.path.exists(dir_path):
        return None

    encodings = []
    for fname in sorted(os.listdir(dir_path)):
        if not fname.lower().endswith((".jpg", ".jpeg", ".png")):
            continue
        img_path = os.path.join(dir_path, fname)
        with open(img_path, "rb") as f:
            enc = extract_encoding_from_image(f.read())
        if enc is not None:
            encodings.append(enc)

    if not encodings:
        return None

    return np.mean(encodings, axis=0)
