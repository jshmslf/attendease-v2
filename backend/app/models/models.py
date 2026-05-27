from sqlalchemy import Column, String, Boolean, DateTime, Float, ForeignKey, Text, Integer, Time, UniqueConstraint
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
    section_id = Column(String, ForeignKey("sections.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=ph_now)

    # Relationships
    section = relationship("Section", backref="students")
    attendances = relationship("Attendance", back_populates="student")
    parents = relationship("Parent", back_populates="student")
    portal_account = relationship("PortalAccount", back_populates="student", uselist=False)
    messages = relationship("StudentMessage", back_populates="student")
    subject_assignments = relationship("StudentSubject", back_populates="student", cascade="all, delete-orphan")


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


class Section(Base):
    __tablename__ = "sections"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, unique=True, nullable=False) 
    created_at = Column(DateTime, default=ph_now)


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(String, primary_key=True, default=generate_uuid)
    subject_code = Column(String, unique=True, nullable=False)  # e.g. "CS101"
    name = Column(String, nullable=False)
    teacher = Column(String, nullable=False)
    created_at = Column(DateTime, default=ph_now)

    schedules = relationship("SubjectSchedule", back_populates="subject", cascade="all, delete-orphan")
    enrolled_students = relationship("StudentSubject", back_populates="subject", cascade="all, delete-orphan")


class SubjectSchedule(Base):
    __tablename__ = "subject_schedules"

    id = Column(String, primary_key=True, default=generate_uuid)
    subject_id = Column(String, ForeignKey("subjects.id"), nullable=False)
    day_of_week = Column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=True)
    room = Column(String, nullable=True)

    subject = relationship("Subject", back_populates="schedules")


class StudentSubject(Base):
    __tablename__ = "student_subjects"
    __table_args__ = (UniqueConstraint("student_id", "subject_id", name="uq_student_subject"),)

    id = Column(String, primary_key=True, default=generate_uuid)
    student_id = Column(String, ForeignKey("students.id"), nullable=False)
    subject_id = Column(String, ForeignKey("subjects.id"), nullable=False)
    assigned_at = Column(DateTime, default=ph_now)

    student = relationship("Student", back_populates="subject_assignments")
    subject = relationship("Subject", back_populates="enrolled_students")


class AppSettings(Base):
    __tablename__ = "app_settings"

    id = Column(String, primary_key=True, default=generate_uuid)
    school_name = Column(String, default="AttendEase")
