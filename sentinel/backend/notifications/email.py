"""E-Mail alert notifier via SMTP (aiosmtplib)."""
from __future__ import annotations

import logging
from email.message import EmailMessage

from backend.core.config import get_secret

logger = logging.getLogger("sentinel.email")


class EmailNotifier:
    def __init__(self) -> None:
        secrets = get_secret()
        notif = secrets.get("notifications", {})
        self._host: str = notif.get("smtp_host", "")
        self._port: int = int(notif.get("smtp_port", 587))
        self._user: str = notif.get("smtp_user", "")
        self._password: str = notif.get("smtp_password", "")
        self._from: str = notif.get("smtp_from", "")
        self._to: str = notif.get("smtp_to", "")

    def _is_configured(self) -> bool:
        return bool(self._host and self._user and self._to)

    async def send_alert(self, subject: str, body: str) -> None:
        if not self._is_configured():
            logger.debug("E-Mail not configured; skipping notification")
            return
        msg = EmailMessage()
        msg["From"] = self._from or self._user
        msg["To"] = self._to
        msg["Subject"] = f"[Sentinel] {subject}"
        msg.set_content(body)
        try:
            import aiosmtplib
            await aiosmtplib.send(
                msg,
                hostname=self._host,
                port=self._port,
                username=self._user,
                password=self._password,
                start_tls=True,
            )
            logger.info("E-Mail alert sent to %s", self._to)
        except Exception as e:  # noqa: BLE001
            logger.error("E-Mail notification failed: %s", e)

    async def send_test(self) -> bool:
        if not self._is_configured():
            return False
        await self.send_alert(
            "Test-Benachrichtigung",
            "✅ Sentinel E-Mail-Benachrichtigungen funktionieren!",
        )
        return True
