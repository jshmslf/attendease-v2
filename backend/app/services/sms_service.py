from typing import Tuple
import logging
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_sms_notification(phone_number: str, message: str) -> Tuple[bool, str | None]:
    """Send SMS via PhilSMS API."""
    if not settings.PHILSMS_TOKEN:
        logger.warning("PHILSMS_TOKEN not set - SMS skipped")
        return False, "SMS token not configured"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(
                "https://dashboard.philsms.com/api/v3/sms/send",
                headers={
                    "Authorization": f"Bearer {settings.PHILSMS_TOKEN}",
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                json={
                    "recipient": phone_number,
                    "sender_id": settings.PHILSMS_SENDER_ID,
                    "type": "plain",
                    "message": message,
                },
            )
        if res.status_code == 200:
            logger.info(f"SMS sent to {phone_number}")
            return True, None
        logger.error(f"PhilSMS error {res.status_code}: {res.text}")
        return False, f"PhilSMS {res.status_code}: {res.text}"
    except Exception as e:
        logger.error(f"SMS exception for {phone_number}: {e}")
        return False, str(e)
