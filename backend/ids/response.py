"""Threat response engine — log, alert, rate-limit, or block based on confidence."""
from __future__ import annotations

import ipaddress
import json
import time
from collections import deque
from pathlib import Path

from backend.core.config import load_config
from backend.core.nftables import NftablesManager

LOG_FILE    = Path("/var/log/sentinel/response.log")
MAX_HISTORY = 1000


class ResponseEngine:
    def __init__(self) -> None:
        self._nft     = NftablesManager()
        self._history: deque[dict] = deque(maxlen=MAX_HISTORY)

    def _is_private_or_local(self, ip: str) -> bool:
        try:
            addr = ipaddress.ip_address(ip)
            return addr.is_private or addr.is_loopback or addr.is_link_local
        except ValueError:
            return True

    async def evaluate_alert(self, alert: dict) -> None:
        cfg        = load_config()
        ids_cfg    = cfg.get("ids", {})
        auto_block = ids_cfg.get("auto_block", False)
        threshold  = ids_cfg.get("confidence_threshold", 80)
        confidence = alert.get("confidence", 0)
        src_ip     = alert.get("src_ip", "")

        if self._is_private_or_local(src_ip):
            return

        action = "log"
        if confidence >= threshold and auto_block:
            action = await self._try_block(src_ip)
        elif confidence >= 60:
            action = await self._try_rate_limit(src_ip)
        elif confidence >= 40:
            action = "alert"

        entry = {**alert, "action": action, "logged_at": time.time()}
        self._history.append(entry)
        await self._write_log(entry)

    async def _try_block(self, ip: str) -> str:
        try:
            await self._nft.add_to_set("inet sentinel_firewall", "blocked_ips", ip)
            return "block"
        except RuntimeError as exc:
            # nft command failed (e.g. duplicate element) — not a programming error
            return f"block_failed: {exc}"

    async def _try_rate_limit(self, ip: str) -> str:
        try:
            await self._nft.add_to_set("inet sentinel_firewall", "rate_limited_ips", ip)
            return "rate_limit"
        except RuntimeError as exc:
            return f"rate_limit_failed: {exc}"

    async def _write_log(self, entry: dict) -> None:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        line = json.dumps(entry) + "\n"
        try:
            import aiofiles
            async with aiofiles.open(LOG_FILE, "a") as f:
                await f.write(line)
        except OSError:
            pass

    async def get_recent_alerts(self, limit: int = 50) -> list[dict]:
        return list(self._history)[-limit:]

    async def get_stats(self) -> dict:
        total = len(self._history)
        return {
            "total":        total,
            "blocked":      sum(1 for e in self._history if e.get("action") == "block"),
            "alerted":      sum(1 for e in self._history if e.get("action") == "alert"),
            "rate_limited": sum(1 for e in self._history if e.get("action") == "rate_limit"),
        }
