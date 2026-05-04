"""Email notification sender via SMTP."""
from __future__ import annotations

from backend.core.config import load_config


async def send_email(subject: str, body: str) -> bool:
    cfg = load_config().get("notifications", {})
    if not cfg.get("email_enabled"):
        return False
    try:
        import aiosmtplib
        from email.message import EmailMessage
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"]    = cfg.get("email_from", "sentinel@localhost")
        msg["To"]      = cfg.get("email_to", "")
        msg.set_content(body)
        await aiosmtplib.send(
            msg,
            hostname=cfg.get("smtp_host", "localhost"),
            port=int(cfg.get("smtp_port", 587)),
            username=cfg.get("smtp_user", ""),
            password=cfg.get("smtp_pass", ""),
            start_tls=True,
        )
        return True
    except Exception:
        return False
