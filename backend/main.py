"""Sentinel Firewall — FastAPI entry point."""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.routes import firewall, nat, dhcp, dns, vpn, threats, scanner, system
from backend.api.websocket import ConnectionManager, stream_traffic_stats
from backend.core.config import load_config
from backend.ids.suricata import SuricataWatcher

manager    = ConnectionManager()
_bg_tasks: list[asyncio.Task] = []


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Notify systemd we're ready
    try:
        import sdnotify
        sdnotify.SystemdNotifier().notify("READY=1")
    except Exception:
        pass

    watcher = SuricataWatcher(manager)
    _bg_tasks.append(asyncio.create_task(watcher.tail_eve_log()))
    _bg_tasks.append(asyncio.create_task(stream_traffic_stats(manager)))

    yield

    for task in _bg_tasks:
        task.cancel()
    await asyncio.gather(*_bg_tasks, return_exceptions=True)


app = FastAPI(
    title="Sentinel Firewall API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url=None,
)

cfg = load_config()
app.add_middleware(
    CORSMiddleware,
    allow_origins=cfg.get("api", {}).get("cors_origins", ["http://localhost:3000"]),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in [firewall.router, nat.router, dhcp.router, dns.router,
               vpn.router, threats.router, scanner.router, system.router]:
    app.include_router(router, prefix="/api")


@app.websocket("/ws")
async def websocket_endpoint(websocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        manager.disconnect(websocket)
