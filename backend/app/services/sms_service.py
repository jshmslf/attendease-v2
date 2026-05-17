from typing import Tuple
import logging
from app.core.timezone import ph_now

logger = logging.getLogger(__name__)


async def send_sms_notification(phone_number: str, message: str) -> Tuple[bool, str | None]:
    """
    Mock SMS service for thesis purposes.
    Logs the notification instead of sending a real SMS.
    Returns (success: bool, error_message: str | None)
    """
    log_line = (
        f"[MOCK SMS] {ph_now().strftime('%Y-%m-%d %H:%M:%S')} "
        f"→ {phone_number}: {message}"
    )
    print(log_line)
    logger.info(log_line)
    return True, None
