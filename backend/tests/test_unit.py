"""
Unit Tests — AttendEase
=======================
Tests individual pure functions with no database or network I/O.
Run with:  pytest tests/test_unit.py -v
"""
import pytest
from datetime import timedelta, datetime, timezone

# ── Security: password hashing ────────────────────────────────────────────────

from app.core.security import hash_password, verify_password


class TestPasswordHashing:
    def test_hash_produces_bcrypt_string(self):
        hashed = hash_password("secret123")
        assert hashed.startswith("$2b$") or hashed.startswith("$2a$")

    def test_correct_password_verifies(self):
        hashed = hash_password("correct_horse")
        assert verify_password("correct_horse", hashed) is True

    def test_wrong_password_does_not_verify(self):
        hashed = hash_password("correct_horse")
        assert verify_password("wrong_horse", hashed) is False

    def test_empty_password_hashes_and_verifies(self):
        hashed = hash_password("")
        assert verify_password("", hashed) is True

    def test_two_hashes_of_same_password_differ(self):
        """bcrypt uses a random salt — same input must not produce same hash."""
        h1 = hash_password("samepass")
        h2 = hash_password("samepass")
        assert h1 != h2


# ── Security: JWT tokens ──────────────────────────────────────────────────────

from app.core.security import create_access_token, decode_token


class TestJWT:
    def test_token_roundtrip(self):
        payload = {"sub": "user-123", "role": "admin"}
        token = create_access_token(payload)
        decoded = decode_token(token)
        assert decoded["sub"] == "user-123"
        assert decoded["role"] == "admin"

    def test_token_contains_expiry(self):
        token = create_access_token({"sub": "u1"})
        decoded = decode_token(token)
        assert "exp" in decoded

    def test_custom_expiry_is_respected(self):
        token = create_access_token({"sub": "u2"}, expires_delta=timedelta(seconds=10))
        decoded = decode_token(token)
        # exp should be within 15 seconds of now
        now = datetime.now(timezone.utc).timestamp()
        assert abs(decoded["exp"] - now - 10) < 5

    def test_tampered_token_raises(self):
        from jose import JWTError
        token = create_access_token({"sub": "u3"}) + "tampered"
        with pytest.raises(JWTError):
            decode_token(token)

    def test_student_token_carries_role(self):
        token = create_access_token({"sub": "acc-456", "role": "student"})
        decoded = decode_token(token)
        assert decoded["role"] == "student"


# ── Confidence label logic ────────────────────────────────────────────────────
#
# Mirrors the ConfidenceBadge logic in the dashboard:
#   score >= 0.90 → "High"
#   score >= 0.70 → "Medium"
#   else          → "Low"

def confidence_label(score: float) -> str:
    if score >= 0.90:
        return "High"
    if score >= 0.70:
        return "Medium"
    return "Low"


class TestConfidenceLabel:
    def test_90_percent_is_high(self):
        assert confidence_label(0.90) == "High"

    def test_100_percent_is_high(self):
        assert confidence_label(1.00) == "High"

    def test_95_percent_is_high(self):
        assert confidence_label(0.95) == "High"

    def test_70_percent_is_medium(self):
        assert confidence_label(0.70) == "Medium"

    def test_80_percent_is_medium(self):
        assert confidence_label(0.80) == "Medium"

    def test_89_percent_is_medium(self):
        assert confidence_label(0.89) == "Medium"

    def test_69_percent_is_low(self):
        assert confidence_label(0.69) == "Low"

    def test_0_percent_is_low(self):
        assert confidence_label(0.0) == "Low"


# ── Attendance rate calculation ───────────────────────────────────────────────
#
# Mirrors the formula in attendance_service.get_attendance_summary:
#   rate = round((present + late) / total * 100, 1)  if total > 0 else 0

def attendance_rate(total: int, present: int, late: int) -> float:
    if total == 0:
        return 0.0
    return round((present + late) / total * 100, 1)


class TestAttendanceRate:
    def test_perfect_attendance(self):
        assert attendance_rate(total=20, present=20, late=0) == 100.0

    def test_all_late_still_counts(self):
        assert attendance_rate(total=10, present=0, late=10) == 100.0

    def test_mixed_present_and_late(self):
        assert attendance_rate(total=20, present=15, late=3) == 90.0

    def test_zero_total_returns_zero(self):
        assert attendance_rate(total=0, present=0, late=0) == 0.0

    def test_below_75_at_risk_threshold(self):
        rate = attendance_rate(total=20, present=10, late=4)
        assert rate == 70.0
        assert rate < 75

    def test_above_90_excellent_threshold(self):
        rate = attendance_rate(total=20, present=19, late=0)
        assert rate == 95.0
        assert rate >= 90


# ── Philippine timezone ───────────────────────────────────────────────────────

from app.core.timezone import ph_now


class TestPhilippineTimezone:
    def test_ph_now_returns_naive_datetime(self):
        now = ph_now()
        assert now.tzinfo is None, "ph_now() should return a naive (tzinfo-stripped) datetime"

    def test_ph_now_is_ahead_of_utc(self):
        import datetime as dt
        utc_now = dt.datetime.utcnow()
        ph = ph_now()
        diff = ph - utc_now
        # PH is UTC+8; allow ±5 min for test execution time
        assert timedelta(hours=7, minutes=55) <= diff <= timedelta(hours=8, minutes=5)
