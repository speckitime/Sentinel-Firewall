"""Sentinel Firewall — FastAPI Application Entry Point."""
from __future__ import annotations

import asyncio
import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm

from backend.api.routes import firewall, nat, dhcp, dns, vpn, threats, ports, system
from backend.api.websocket import ConnectionManager, stream_traffic_stats
from backend.core.config import load_config, get_secret
from backend.core.auth import create_access_token, verify_password

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("sentinel")

# ---------------------------------------------------------------------------
# Global state
# ---------------------------------------------------------------------------
manager = ConnectionManager()
_background_tasks: list[asyncio.Task] = []


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:  # noqa: RUF029
    """Application lifespan: startup → yield → shutdown."""
    logger.info("Sentinel API starting up...")

    # Notify systemd we are ready (Type=notify)
    try:
        import sdnotify  # type: ignore[import-untyped]
        sdnotify.SystemdNotifier().notify("READY=1")
    except Exception:  # noqa: BLE001
        pass

    # Start background tasks
    _background_tasks.append(
        asyncio.create_task(stream_traffic_stats(manager), name="traffic-streamer")
    )

    yield

    logger.info("Sentinel API shutting down...")
    for task in _background_tasks:
        task.cancel()
    await asyncio.gather(*_background_tasks, return_exceptions=True)


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Sentinel Firewall API",
    version="1.0.0",
    description="Self-hosted network firewall management API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Auth endpoint (no JWT required)
# ---------------------------------------------------------------------------
@app.post("/api/system/auth/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()) -> dict:
    secret = get_secret()
    stored_hash = secret.get("api", {}).get("admin_password_hash", "")
    if not stored_hash or not verify_password(form_data.password, stored_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token({"sub": form_data.username})
    return {"access_token": token, "token_type": "bearer"}


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(firewall.router, prefix="/api/firewall", tags=["firewall"])
app.include_router(nat.router, prefix="/api/nat", tags=["nat"])
app.include_router(dhcp.router, prefix="/api/dhcp", tags=["dhcp"])
app.include_router(dns.router, prefix="/api/dns", tags=["dns"])
app.include_router(vpn.router, prefix="/api/vpn", tags=["vpn"])
app.include_router(threats.router, prefix="/api/threats", tags=["threats"])
app.include_router(ports.router, prefix="/api/ports", tags=["ports"])
app.include_router(system.router, prefix="/api/system", tags=["system"])


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------
@app.websocket("/ws")
async def websocket_endpoint(websocket) -> None:  # type: ignore[type-arg]
    from backend.api.websocket import handle_websocket
    await handle_websocket(websocket, manager)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "sentinel-api"}
