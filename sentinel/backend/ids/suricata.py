"""Suricata EVE JSON log monitor and alert parser."""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from pathlib import Path
from typing import AsyncIterator

import aiofiles

logger = logging.getLogger("sentinel.ids")

EVE_LOG_PATHS = [
    Path("/var/log/suricata/eve.json"),
    Path("/var/log/sentinel/suricata-eve.json"),
]


def _eve_log() -> Path | None:
    for p in EVE_LOG_PATHS:
        if p.exists():
            return p
    return None


_SEVERITY_CONFIDENCE = {1: 90, 2: 60, 3: 30}
_ACKNOWLEDGED: set[str] = set()


class SuricataMonitor:
    async def get_recent_alerts(
        self, limit: int = 100, since: float | None = None
    ) -> list[dict]:
        log_path = _eve_log()
        if not log_path:
            return []
        alerts = []
        try:
            async with aiofiles.open(log_path) as f:
                lines = await f.readlines()
            for line in reversed(lines):
                try:
                    event = json.loads(line.strip())
                except json.JSONDecodeError:
                    continue
                if event.get("event_type") != "alert":
                    continue
                if since and event.get("flow_id", 0) < since:
                    continue
                alert_id = str(event.get("flow_id", uuid.uuid4().hex))
                alert = {
                    "id": alert_id,
                    "timestamp": event.get("timestamp", ""),
                    "src_ip": event.get("src_ip", ""),
                    "dest_ip": event.get("dest_ip", ""),
                    "src_port": event.get("src_port", 0),
                    "dest_port": event.get("dest_port", 0),
                    "proto": event.get("proto", ""),
                    "signature": event.get("alert", {}).get("signature", ""),
                    "category": event.get("alert", {}).get("category", ""),
                    "severity": event.get("alert", {}).get("severity", 3),
                    "confidence": self.calculate_confidence(event),
                    "acknowledged": alert_id in _ACKNOWLEDGED,
                }
                alerts.append(alert)
                if len(alerts) >= limit:
                    break
        except Exception as e:  # noqa: BLE001
            logger.error("Error reading EVE log: %s", e)
        return alerts

    async def get_alert_by_id(self, alert_id: str) -> dict:
        alerts = await self.get_recent_alerts(limit=500)
        for a in alerts:
            if a["id"] == alert_id:
                return a
        return {"error": f"Alert {alert_id} not found"}

    async def acknowledge_alert(self, alert_id: str) -> None:
        _ACKNOWLEDGED.add(alert_id)

    def calculate_confidence(self, event: dict) -> int:
        severity = event.get("alert", {}).get("severity", 3)
        base = _SEVERITY_CONFIDENCE.get(severity, 30)
        # Boost score for known dangerous categories
        category = event.get("alert", {}).get("category", "").lower()
        if any(k in category for k in ("exploit", "malware", "trojan", "dos")):
            base = min(100, base + 20)
        return base

    async def tail_eve_log(self) -> AsyncIterator[dict]:
        """Async generator yielding new EVE events as they appear."""
        log_path = _eve_log()
        if not log_path:
            logger.warning("EVE log not found; waiting...")
            while True:
                await asyncio.sleep(10)
                log_path = _eve_log()
                if log_path:
                    break

        async with aiofiles.open(log_path) as f:
            await f.seek(0, 2)  # Seek to end
            while True:
                line = await f.readline()
                if line:
                    try:
                        yield json.loads(line.strip())
                    except json.JSONDecodeError:
                        pass
                else:
                    await asyncio.sleep(0.5)
