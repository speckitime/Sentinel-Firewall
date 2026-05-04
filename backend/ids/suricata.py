"""Suricata EVE JSON log watcher."""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

from backend.core.config import load_config
from .response import ResponseEngine


class SuricataWatcher:
    def __init__(self, manager) -> None:
        self._manager  = manager
        self._engine   = ResponseEngine()

    async def tail_eve_log(self) -> None:
        eve_path = Path(load_config()["ids"]["eve_log"])
        # Wait for log to exist
        while not eve_path.exists():
            await asyncio.sleep(5)

        with open(eve_path) as f:
            f.seek(0, 2)  # Seek to end
            while True:
                line = f.readline()
                if not line:
                    await asyncio.sleep(0.2)
                    continue
                try:
                    event = json.loads(line)
                    if event.get("event_type") == "alert":
                        alert = self._parse_alert(event)
                        await self._engine.evaluate_alert(alert)
                        await self._manager.broadcast({"type": "threat", "data": alert})
                except (json.JSONDecodeError, KeyError):
                    continue

    def _parse_alert(self, event: dict) -> dict:
        alert_data = event.get("alert", {})
        severity   = alert_data.get("severity", 3)
        confidence_map = {1: 90, 2: 60, 3: 30}
        return {
            "src_ip":     event.get("src_ip", ""),
            "dest_ip":    event.get("dest_ip", ""),
            "src_port":   event.get("src_port"),
            "dest_port":  event.get("dest_port"),
            "protocol":   event.get("proto", ""),
            "signature":  alert_data.get("signature", ""),
            "category":   alert_data.get("category", ""),
            "severity":   severity,
            "confidence": confidence_map.get(severity, 30),
            "timestamp":  event.get("timestamp", ""),
        }
