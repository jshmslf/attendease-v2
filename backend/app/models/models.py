from sqlalchemy import Column, String, Boolean, DateTime, Float, ForeignKey, Text, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.db.session import Base
from app.core.timezone import ph_now

def generate_uuid():
    return str(uuid.uuid4())

class Student(Base):
    __tablename__ = "students"

    id = Column(String, primary_key=True, default=generate_uuid)
    student_id = Column(String, unique=True, nullable=False, index=True)  # e.g. "2021-00123"
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    course = Column(String, nullable=False)
    year_level = Column(Integer, nullable=False)
    profile_image_url = Column(String, nullable=True)
    face_encoding = Column(Text, nullable=True)  # JSON-serialized numpy array
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=ph_now)

    # Relationships
    attendances = relationship("Attendance", back_populates="student")
    parents = relationship("Parent", back_populates="student")
    portal_account = relationship("PortalAccount", back_populates="student", uselist=False)
    messages = relationship("StudentMessage", back_populates="student")


class Parent(Base):
    __tablename__ = "parents"

    id = Column(String, primary_key=True, default=generate_uuid)
    student_id = Column(String, ForeignKey("students.id"), nullable=False)
    name = Column(String, nullable=False)
    phone_number = Column(String, nullable=False)  # E.164 format: +639XXXXXXXXX
    relationship_to_student = Column(String, default="Parent")  # Parent, Guardian, etc.
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=ph_now)

    student = relationship("Student", back_populates="parents")
    notifications = relationship("NotificationLog", back_populates="parent")


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(String, primary_key=True, default=generate_uuid)
    student_id = Column(String, ForeignKey("students.id"), nullable=False)
    date = Column(DateTime, nullable=False)           # Date of attendance
    time_in = Column(DateTime, nullable=False)        # Exact time scanned
    confidence_score = Column(Float, nullable=True)   # Face match confidence
    camera_id = Column(String, nullable=True)         # Which gateway camera
    status = Column(String, default="present")        # present, late, absent
    is_manual_override = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=ph_now)

    student = relationship("Student", back_populates="attendances")


class Camera(Base):
    __tablename__ = "cameras"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)             # e.g. "Main Gate"
    location = Column(String, nullable=False)
    stream_url = Column(String, nullable=True)        # RTSP or webcam index
    is_active = Column(Boolean, default=True)
    last_ping = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=ph_now)


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    parent_id = Column(String, ForeignKey("parents.id"), nullable=False)
    attendance_id = Column(String, ForeignKey("attendance.id"), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String, default="pending")        # pending, sent, failed
    sent_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=ph_now)

    parent = relationship("Parent", back_populates="notifications")


class PortalAccount(Base):
    __tablename__ = "portal_accounts"

    id = Column(String, primary_key=True, default=generate_uuid)
    student_id = Column(String, ForeignKey("students.id"), unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=ph_now)

    student = relationship("Student", back_populates="portal_account")


class StudentMessage(Base):
    __tablename__ = "student_messages"

    id = Column(String, primary_key=True, default=generate_uuid)
    student_id = Column(String, ForeignKey("students.id"), nullable=False)
    body = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=ph_now)

    student = relationship("Student", back_populates="messages")


class AdminAccount(Base):
    __tablename__ = "admin_accounts"

    id = Column(String, primary_key=True, default=generate_uuid)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, default="admin")            # admin, superadmin
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=ph_now)
