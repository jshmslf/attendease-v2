"""
Integration Tests — AttendEase
================================
Tests full HTTP request → FastAPI route → test database → response flows.

Requirements:
    pip install pytest pytest-asyncio pytest-html httpx

Environment:
    Set TEST_DATABASE_URL before running, e.g.:
        TEST_DATABASE_URL=postgresql+asyncpg://user:pass@host/attendease_test pytest

Run all integration tests:
    pytest tests/test_integration.py -v

Generate HTML report:
    pytest tests/ --html=test_report.html --self-contained-html
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient

# ── Health check ──────────────────────────────────────────────────────────────

class TestHealthCheck:
    async def test_api_is_running(self, client: AsyncClient):
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


# ── Authentication ────────────────────────────────────────────────────────────

class TestAdminAuth:
    async def test_admin_login_success(self, client: AsyncClient, admin_token: str):
        """admin_token fixture already performs login; just assert the token is truthy."""
        assert isinstance(admin_token, str)
        assert len(admin_token) > 20

    async def test_admin_login_wrong_password(self, client: AsyncClient, admin_token: str):
        response = await client.post(
            "/api/auth/admin/login",
            json={"username": "pytest_admin", "password": "wrong_password"},
        )
        assert response.status_code == 401

    async def test_admin_login_unknown_user(self, client: AsyncClient):
        response = await client.post(
            "/api/auth/admin/login",
            json={"username": "does_not_exist", "password": "anything"},
        )
        assert response.status_code == 401

    async def test_protected_route_without_token_returns_401(self, client: AsyncClient):
        response = await client.get("/api/students/")
        assert response.status_code in (401, 403)


# ── Sections ──────────────────────────────────────────────────────────────────

class TestSections:
    async def test_create_section(self, client: AsyncClient, admin_token: str):
        response = await client.post(
            "/api/sections/",
            json={"name": "BSIT 1-A (Test)"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "BSIT 1-A (Test)"
        assert "id" in data

    async def test_list_sections(self, client: AsyncClient, admin_token: str):
        response = await client.get(
            "/api/sections/",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_create_duplicate_section_fails(self, client: AsyncClient, admin_token: str):
        await client.post(
            "/api/sections/",
            json={"name": "BSIT 2-B (Dup Test)"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        response = await client.post(
            "/api/sections/",
            json={"name": "BSIT 2-B (Dup Test)"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 400


# ── Students ──────────────────────────────────────────────────────────────────

class TestStudents:
    async def test_create_student(self, client: AsyncClient, admin_token: str):
        response = await client.post(
            "/api/students/",
            json={
                "student_id": "2024-TEST01",
                "first_name": "Juan",
                "last_name": "dela Cruz",
                "email": "juan.delacruz.test@school.edu.ph",
                "course": "BSIT",
                "year_level": 1,
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["student_id"] == "2024-TEST01"
        assert data["first_name"] == "Juan"
        assert data["has_face_enrolled"] is False

    async def test_create_duplicate_student_fails(self, client: AsyncClient, admin_token: str):
        payload = {
            "student_id": "2024-TEST02",
            "first_name": "Maria",
            "last_name": "Santos",
            "email": "maria.santos.test@school.edu.ph",
            "course": "BSCS",
            "year_level": 2,
        }
        await client.post(
            "/api/students/", json=payload,
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        response = await client.post(
            "/api/students/", json=payload,
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 400

    async def test_list_students_returns_array(self, client: AsyncClient, admin_token: str):
        response = await client.get(
            "/api/students/",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_get_student_by_id(self, client: AsyncClient, admin_token: str):
        response = await client.get(
            "/api/students/2024-TEST01",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        assert response.json()["student_id"] == "2024-TEST01"

    async def test_get_nonexistent_student_returns_404(self, client: AsyncClient, admin_token: str):
        response = await client.get(
            "/api/students/9999-NOTREAL",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 404

    async def test_update_student_email(self, client: AsyncClient, admin_token: str):
        response = await client.put(
            "/api/students/2024-TEST01",
            json={"email": "juan.updated.test@school.edu.ph"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        assert response.json()["email"] == "juan.updated.test@school.edu.ph"


# ── Student portal account + login ────────────────────────────────────────────

class TestStudentPortal:
    async def test_create_portal_account(self, client: AsyncClient, admin_token: str):
        response = await client.post(
            "/api/students/2024-TEST01/portal-account",
            json={"password": "Student@1234"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200

    async def test_student_login_success(self, client: AsyncClient):
        response = await client.post(
            "/api/auth/student/login",
            json={"student_id": "2024-TEST01", "password": "Student@1234"},
        )
        assert response.status_code == 200
        assert "access_token" in response.json()

    async def test_student_login_wrong_password(self, client: AsyncClient):
        response = await client.post(
            "/api/auth/student/login",
            json={"student_id": "2024-TEST01", "password": "wrong"},
        )
        assert response.status_code == 401

    async def test_student_login_unknown_id(self, client: AsyncClient):
        response = await client.post(
            "/api/auth/student/login",
            json={"student_id": "9999-NOBODY", "password": "pass"},
        )
        assert response.status_code == 401


# ── Attendance ────────────────────────────────────────────────────────────────

class TestAttendance:
    async def test_manual_attendance_mark(self, client: AsyncClient, admin_token: str):
        """Mark attendance manually via the admin override endpoint."""
        from datetime import date
        today = date.today().strftime("%Y-%m-%d")

        response = await client.post(
            "/api/attendance/override",
            json={
                "student_id": "2024-TEST01",
                "date": today,
                "status": "present",
                "notes": "Manual test entry",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        assert "updated" in response.json()["message"].lower()

    async def test_get_attendance_list(self, client: AsyncClient, admin_token: str):
        response = await client.get(
            "/api/attendance/by-date",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

