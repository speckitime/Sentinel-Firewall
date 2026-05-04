"""WebSocket connection manager and traffic stats streamer."""
from __future__ import annotations

import asyncio
import json
import time
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._active: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._active.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self._active.discard(ws) if hasattr(self._active, "discard") else None
        if ws in self._active:
            self._active.remove(ws)

    async def broadcast(self, data: Any) -> None:
        dead: list[WebSocket] = []
        msg = json.dumps(data) if not isinstance(data, str) else data
        for ws in list(self._active):
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


async def stream_traffic_stats(manager: ConnectionManager) -> None:
    """Read /proc/net/dev and broadcast bytes/sec per interface every second."""
    prev: dict[str, tuple[int, int]] = {}
    prev_time = time.monotonic()

    while True:
        await asyncio.sleep(1)
        now = time.monotonic()
        elapsed = now - prev_time
        prev_time = now

        stats: dict[str, Any] = {"type": "traffic", "interfaces": {}}
        try:
            with open("/proc/net/dev") as f:
                lines = f.readlines()[2:]
            for line in lines:
                parts = line.split()
                iface = parts[0].rstrip(":")
                rx_bytes = int(parts[1])
                tx_bytes = int(parts[9])
                if iface in prev:
                    p_rx, p_tx = prev[iface]
                    stats["interfaces"][iface] = {
                        "rx_bps": max(0, int((rx_bytes - p_rx) / elapsed)),
                        "tx_bps": max(0, int((tx_bytes - p_tx) / elapsed)),
                    }
                prev[iface] = (rx_bytes, tx_bytes)
        except Exception:
            pass

        if manager._active:
            await manager.broadcast(stats)
