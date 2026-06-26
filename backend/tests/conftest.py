"""
Test configuration for AttendEase.

Integration tests connect to the database configured in your .env file
(DATABASE_URL). You can override this by setting TEST_DATABASE_URL in your
environment to point at a dedicated test database.

WARNING: teardown only deletes rows created by the test suite — it never
calls drop_all, so it is safe to run against the NeonTech production database.
"""
import asyncio
import os

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

# ── DB URL: env override → .env DATABASE_URL ─────────────────────────────────

from app.core.config import settings  # reads .env

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL") or settings.DATABASE_URL

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)

# ── Override app DB dependency ────────────────────────────────────────────────

from app.main import app
from app.db.session import Base, get_db


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db

# ── Session-scoped event loop (pytest-asyncio < 0.23 compatibility) ───────────


@pytest.fixture(scope="session")
def event_loop():
    """Single event loop shared across the entire test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ── Helper: delete test rows in FK-safe order ────────────────────────────────


async def _delete_test_data(session):
    """Remove all rows seeded by this test suite. Safe to call on an empty DB."""
    from app.models.models import (
        AdminAccount, Attendance, NotificationLog,
        Parent, PortalAccount, Section, Student, StudentMessage,
    )

    # Resolve UUIDs of test students (attendance FK uses students.id, not student_id)
    result = await session.execute(
        select(Student.id).where(Student.student_id.like("2024-TEST%"))
    )
    test_uuids = [row[0] for row in result.fetchall()]

    if test_uuids:
        # FK grandchildren: notification_logs → attendance / parents
        att_result = await session.execute(
            select(Attendance.id).where(Attendance.student_id.in_(test_uuids))
        )
        att_ids = [row[0] for row in att_result.fetchall()]
        if att_ids:
            await session.execute(
                delete(NotificationLog).where(NotificationLog.attendance_id.in_(att_ids))
            )

        par_result = await session.execute(
            select(Parent.id).where(Parent.student_id.in_(test_uuids))
        )
        par_ids = [row[0] for row in par_result.fetchall()]
        if par_ids:
            await session.execute(
                delete(NotificationLog).where(NotificationLog.parent_id.in_(par_ids))
            )

        # FK children of students
        await session.execute(delete(Attendance).where(Attendance.student_id.in_(test_uuids)))
        await session.execute(delete(PortalAccount).where(PortalAccount.student_id.in_(test_uuids)))
        await session.execute(delete(StudentMessage).where(StudentMessage.student_id.in_(test_uuids)))
        await session.execute(delete(Parent).where(Parent.student_id.in_(test_uuids)))

    await session.execute(delete(Student).where(Student.student_id.like("2024-TEST%")))
    await session.execute(delete(Section).where(Section.name.like("%(Test)%")))
    await session.execute(delete(AdminAccount).where(AdminAccount.username == "pytest_admin"))
    await session.commit()


# ── DB setup / teardown — NOT autouse so unit tests skip it ──────────────────


@pytest_asyncio.fixture(scope="session")
async def setup_test_db():
    """
    Create any missing tables (no-op when tables already exist).
    Cleans up leftover test rows at the start (idempotent) and at the end.
    """
    import app.db.base  # noqa: F401 — registers all models with Base.metadata

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Clean up any leftovers from a previously failed run
    async with TestSessionLocal() as session:
        await _delete_test_data(session)

    yield

    # Targeted row-level cleanup — safe on the production NeonTech DB
    async with TestSessionLocal() as session:
        await _delete_test_data(session)

    await test_engine.dispose()


# ── Shared fixtures ───────────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def client(setup_test_db):
    """HTTP client wired directly to the FastAPI ASGI app (no real server).
    Depends on setup_test_db so integration tests auto-trigger DB setup."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as ac:
        yield ac


@pytest_asyncio.fixture(scope="session")
async def admin_token(setup_test_db):
    """
    Seed one admin account (idempotent) and return its JWT.
    Session-scoped: created once and reused across all tests.
    """
    from app.core.security import hash_password
    from app.models.models import AdminAccount

    async with TestSessionLocal() as session:
        existing = await session.execute(
            select(AdminAccount).where(AdminAccount.username == "pytest_admin")
        )
        if not existing.scalar_one_or_none():
            admin = AdminAccount(
                username="pytest_admin",
                email="pytest_admin@test.local",
                hashed_password=hash_password("Pytest@1234"),
                full_name="Pytest Admin",
                is_active=True,
            )
            session.add(admin)
            await session.commit()

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as ac:
        response = await ac.post(
            "/api/auth/admin/login",
            json={"username": "pytest_admin", "password": "Pytest@1234"},
        )

    return response.json()["access_token"]
