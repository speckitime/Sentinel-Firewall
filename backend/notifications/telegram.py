"""Telegram notification sender."""
from __future__ import annotations

import aiohttp

from backend.core.config import load_config


async def send_telegram(message: str) -> bool:
    cfg = load_config().get("notifications", {})
    token   = cfg.get("telegram_bot_token", "")
    chat_id = cfg.get("telegram_chat_id", "")
    if not token or not chat_id:
        return False
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json={"chat_id": chat_id, "text": message, "parse_mode": "HTML"}) as resp:
            return resp.status == 200
