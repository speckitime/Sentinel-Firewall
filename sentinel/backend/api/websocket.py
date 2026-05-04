"""WebSocket connection manager and live traffic streamer."""
from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger("sentinel.ws")


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("WebSocket connected. Total: %d", len(self.active_connections))

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info("WebSocket disconnected. Total: %d", len(self.active_connections))

    async def broadcast(self, data: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for ws in list(self.active_connections):
            try:
                await ws.send_json(data)
            except Exception:  # noqa: BLE001
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


async def handle_websocket(websocket: WebSocket, manager: ConnectionManager) -> None:
    await manager.connect(websocket)
    try:
        while True:
            # Keep alive; client may send pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:  # noqa: BLE001
        manager.disconnect(websocket)


async def stream_traffic_stats(manager: ConnectionManager) -> None:
    """Broadcast interface traffic deltas every 2 seconds."""
    prev: dict[str, dict] = {}
    while True:
        try:
            await asyncio.sleep(2)
            stats = _read_proc_net_dev()
            delta: dict[str, dict] = {}
            for iface, cur in stats.items():
                if iface in prev:
                    p = prev[iface]
                    delta[iface] = {
                        "rx_bps": max(0, (cur["rx_bytes"] - p["rx_bytes"]) // 2),
                        "tx_bps": max(0, (cur["tx_bytes"] - p["tx_bytes"]) // 2),
                        "rx_packets": max(0, cur["rx_packets"] - p["rx_packets"]),
                        "tx_packets": max(0, cur["tx_packets"] - p["tx_packets"]),
                    }
            prev = stats
            if delta and manager.active_connections:
                await manager.broadcast({
                    "type": "traffic",
                    "timestamp": time.time(),
                    "data": delta,
                })
        except asyncio.CancelledError:
            break
        except Exception as e:  # noqa: BLE001
            logger.debug("Traffic streamer error: %s", e)


def _read_proc_net_dev() -> dict[str, dict]:
    result: dict[str, dict] = {}
    try:
        with open("/proc/net/dev") as f:
            lines = f.readlines()[2:]  # Skip headers
        for line in lines:
            parts = line.split()
            if len(parts) < 10:
                continue
            iface = parts[0].rstrip(":")
            if iface == "lo":
                continue
            result[iface] = {
                "rx_bytes": int(parts[1]),
                "rx_packets": int(parts[2]),
                "tx_bytes": int(parts[9]),
                "tx_packets": int(parts[10]),
            }
    except Exception:  # noqa: BLE001
        pass
    return result
