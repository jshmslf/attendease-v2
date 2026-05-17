from datetime import datetime
from zoneinfo import ZoneInfo

PH_TZ = ZoneInfo("Asia/Manila")


def ph_now() -> datetime:
    """Return current datetime in Philippine Time (UTC+8) as a naive datetime."""
    return datetime.now(PH_TZ).replace(tzinfo=None)
