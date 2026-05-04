"""Telegram bot alert notifier."""
from __future__ import annotations

import logging

import httpx

from backend.core.config import get_secret

logger = logging.getLogger("sentinel.telegram")

TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"


class TelegramNotifier:
    def __init__(self) -> None:
        secrets = get_secret()
        notif = secrets.get("notifications", {})
        self._token: str = notif.get("telegram_bot_token", "")
        self._chat_id: str = notif.get("telegram_chat_id", "")

    def _is_configured(self) -> bool:
        return bool(self._token and self._chat_id)

    async def send_alert(self, message: str) -> None:
        if not self._is_configured():
            logger.debug("Telegram not configured; skipping notification")
            return
        url = TELEGRAM_API.format(token=self._token)
        payload = {
            "chat_id": self._chat_id,
            "text": f"🚨 *Sentinel Alert*\n\n{message}",
            "parse_mode": "Markdown",
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                logger.info("Telegram alert sent successfully")
        except Exception as e:  # noqa: BLE001
            logger.error("Telegram notification failed: %s", e)

    async def send_test(self) -> bool:
        if not self._is_configured():
            return False
        await self.send_alert("✅ Sentinel Telegram-Benachrichtigungen funktionieren!")
        return True
