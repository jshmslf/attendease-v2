import os
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.models.models import Student, Parent, PortalAccount
from app.services.face_service import (
    extract_encoding_from_image,
    encode_face_array,
    save_face_image,
    retrain_student_encoding,
)
from app.core.security import get_current_admin, get_current_student, hash_password
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


class StudentCreate(BaseModel):
    student_id: str
    first_name: str
    last_name: str
    email: str
    course: str
    year_level: int


class StudentUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    course: Optional[str] = None
    year_level: Optional[int] = None


class StudentSelfUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None


class ParentCreate(BaseModel):
    name: str
    phone_number: str
    relationship_to_student: str = "Parent"


class ParentUpdate(BaseModel):
    name: Optional[str] = None
    phone_number: Optional[str] = None
    relationship_to_student: Optional[str] = None


class PortalAccountCreate(BaseModel):
    password: str


class PortalAccountUpdate(BaseModel):
    password: str


class StudentResponse(BaseModel):
    id: str
    student_id: str
    first_name: str
    last_name: str
    email: str
    course: str
    year_level: int
    has_face_enrolled: bool
    is_active: bool

    class Config:
        from_attributes = True


class ParentResponse(BaseModel):
    id: str
    name: str
    phone_number: str
    relationship_to_student: str

    class Config:
        from_attributes = True


# ── Student self-service (student JWT) ──────────────────────────────────────

@router.get("/me", response_model=StudentResponse)
async def get_my_profile(
    current_student: Student = Depends(get_current_student),
):
    """Student portal: get own profile."""
    return {**current_student.__dict__, "has_face_enrolled": current_student.face_encoding is not None}


@router.put("/me", response_model=StudentResponse)
async def update_my_profile(
    data: StudentSelfUpdate,
    db: AsyncSession = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    """Student portal: update own name / email."""
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(current_student, field, value)
    await db.commit()
    await db.refresh(current_student)
    return {**current_student.__dict__, "has_face_enrolled": current_student.face_encoding is not None}


@router.get("/me/parents", response_model=list[ParentResponse])
async def get_my_parents(
    db: AsyncSession = Depends(get_db),
    current_student: Student = Depends(get_current_student),
):
    """Student portal: get own parent/guardian contacts."""
    result = await db.execute(
        select(Parent).where(Parent.student_id == current_student.id)
    )
    return result.scalars().all()


# ── Admin endpoints ──────────────────────────────────────────────────────────

@router.post("/", response_model=StudentResponse)
async def create_student(
    data: StudentCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    """Register a new student (admin only)."""
    existing = await db.execute(
        select(Student).where(Student.student_id == data.student_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Student ID already exists.")

    student = Student(**data.model_dump())
    db.add(student)
    await db.commit()
    await db.refresh(student)
    return {**student.__dict__, "has_face_enrolled": False}


@router.post("/{student_id}/enroll-face")
async def enroll_face(
    student_id: str,
    image: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    """Upload a photo to enroll the student's face."""
    result = await db.execute(
        select(Student).where(Student.student_id == student_id)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    image_bytes = await image.read()
    saved_path = await save_face_image(student.id, image_bytes)

    encoding = extract_encoding_from_image(image_bytes)
    if encoding is None:
        raise HTTPException(
            status_code=400,
            detail="No face detected in the image. Please upload a clear, front-facing photo."
        )

    student.face_encoding = encode_face_array(encoding)
    student.profile_image_url = f"/static/faces/{student.id}/photo_001.jpg"
    await db.commit()

    return {
        "message": f"Face enrolled successfully for {student.first_name} {student.last_name}.",
        "photo_path": saved_path,
    }


@router.post("/train")
async def train_all_faces(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    """Re-extract face encodings from all stored photos."""
    result = await db.execute(select(Student).where(Student.is_active == True))
    students = result.scalars().all()

    updated = 0
    failed = []

    for student in students:
        encoding = retrain_student_encoding(student.id)
        if encoding is not None:
            student.face_encoding = encode_face_array(encoding)
            updated += 1
        else:
            if student.face_encoding is None:
                failed.append(student.student_id)

    await db.commit()
    return {
        "message": f"Training complete. {updated} students updated.",
        "failed": failed,
    }


@router.delete("/{student_id}/photos/{filename}")
async def delete_student_photo(
    student_id: str,
    filename: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    """Delete a specific enrolled face photo for a student (admin only)."""
    result = await db.execute(select(Student).where(Student.student_id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    safe_filename = os.path.basename(filename)
    file_path = os.path.join(settings.LOCAL_STORAGE_PATH, student.id, safe_filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Photo not found.")

    os.remove(file_path)

    dir_path = os.path.join(settings.LOCAL_STORAGE_PATH, student.id)
    remaining = [f for f in os.listdir(dir_path) if f.lower().endswith((".jpg", ".jpeg", ".png"))]
    if not remaining:
        student.face_encoding = None
        await db.commit()

    return {"message": f"Photo {safe_filename} deleted."}


@router.get("/{student_id}/photos")
async def list_student_photos(
    student_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    """List all enrolled face photos for a student."""
    result = await db.execute(
        select(Student).where(Student.student_id == student_id)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    dir_path = os.path.join(settings.LOCAL_STORAGE_PATH, student.id)
    photos = []
    if os.path.exists(dir_path):
        photos = [
            f"/static/faces/{student.id}/{f}"
            for f in sorted(os.listdir(dir_path))
            if f.lower().endswith((".jpg", ".jpeg", ".png"))
        ]
    return {"student_id": student_id, "photos": photos}


@router.delete("/{student_id}/parents/{parent_id}")
async def delete_parent(
    student_id: str,
    parent_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    """Delete a parent/guardian contact (admin only)."""
    result = await db.execute(select(Student).where(Student.student_id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    parent_result = await db.execute(
        select(Parent).where(Parent.id == parent_id, Parent.student_id == student.id)
    )
    parent = parent_result.scalar_one_or_none()
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found.")

    await db.delete(parent)
    await db.commit()
    return {"message": "Parent contact deleted."}


@router.get("/{student_id}/parents", response_model=list[ParentResponse])
async def list_parents(
    student_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    """List parent/guardian contacts for a student."""
    result = await db.execute(
        select(Student).where(Student.student_id == student_id)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    parents = await db.execute(
        select(Parent).where(Parent.student_id == student.id)
    )
    return parents.scalars().all()


@router.put("/{student_id}/parents/{parent_id}", response_model=ParentResponse)
async def update_parent(
    student_id: str,
    parent_id: str,
    data: ParentUpdate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    """Update a parent/guardian contact (admin only)."""
    result = await db.execute(
        select(Student).where(Student.student_id == student_id)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    parent_result = await db.execute(
        select(Parent).where(Parent.id == parent_id, Parent.student_id == student.id)
    )
    parent = parent_result.scalar_one_or_none()
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found.")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(parent, field, value)

    await db.commit()
    await db.refresh(parent)
    return parent


@router.get("/{student_id}/portal-account")
async def get_portal_account(
    student_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    """Get portal account info for a student (admin only)."""
    result = await db.execute(
        select(Student).where(Student.student_id == student_id)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    account_result = await db.execute(
        select(PortalAccount).where(PortalAccount.student_id == student.id)
    )
    account = account_result.scalar_one_or_none()
    if not account:
        return {"has_account": False}
    return {"has_account": True, "id": account.id}


@router.put("/{student_id}/portal-account")
async def update_portal_account(
    student_id: str,
    data: PortalAccountUpdate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    """Reset a student's portal account password (admin only)."""
    result = await db.execute(
        select(Student).where(Student.student_id == student_id)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    account_result = await db.execute(
        select(PortalAccount).where(PortalAccount.student_id == student.id)
    )
    account = account_result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="No portal account found for this student.")

    account.hashed_password = hash_password(data.password)
    await db.commit()
    return {"message": "Password updated successfully."}


@router.post("/{student_id}/portal-account")
async def create_portal_account(
    student_id: str,
    data: PortalAccountCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    """Create a student portal login account (admin only)."""
    result = await db.execute(
        select(Student).where(Student.student_id == student_id)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    existing = await db.execute(
        select(PortalAccount).where(PortalAccount.student_id == student.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Portal account already exists for this student.")

    account = PortalAccount(
        student_id=student.id,
        hashed_password=hash_password(data.password),
    )
    db.add(account)
    await db.commit()
    return {"message": f"Portal account created for {student.first_name} {student.last_name}."}


@router.post("/{student_id}/parents")
async def add_parent(
    student_id: str,
    data: ParentCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    """Add a parent/guardian contact for SMS notifications."""
    result = await db.execute(
        select(Student).where(Student.student_id == student_id)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    parent = Parent(student_id=student.id, **data.model_dump())
    db.add(parent)
    await db.commit()
    return {"message": "Parent contact added successfully."}


@router.get("/", response_model=list[StudentResponse])
async def list_students(
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    """List all active students (admin only)."""
    result = await db.execute(select(Student).where(Student.is_active == True))
    students = result.scalars().all()
    return [
        {**s.__dict__, "has_face_enrolled": s.face_encoding is not None}
        for s in students
    ]


@router.put("/{student_id}", response_model=StudentResponse)
async def update_student(
    student_id: str,
    data: StudentUpdate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    """Update student details (admin only)."""
    result = await db.execute(
        select(Student).where(Student.student_id == student_id)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(student, field, value)

    await db.commit()
    await db.refresh(student)
    return {**student.__dict__, "has_face_enrolled": student.face_encoding is not None}


@router.delete("/{student_id}")
async def delete_student(
    student_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    """Permanently delete a student and all related data (admin only)."""
    result = await db.execute(
        select(Student).where(Student.student_id == student_id)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    await db.delete(student)
    await db.commit()
    return {"message": f"Student {student_id} deleted."}


@router.get("/{student_id}")
async def get_student(
    student_id: str,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
):
    result = await db.execute(
        select(Student).where(Student.student_id == student_id)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    return {**student.__dict__, "has_face_enrolled": student.face_encoding is not None}
