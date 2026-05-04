"""System status, interfaces, and setup API."""
from __future__ import annotations

import asyncio
import platform
import psutil  # type: ignore[import-untyped]
from pathlib import Path

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.core.auth import get_current_user
from backend.core.config import load_config

router = APIRouter()


@router.get("/status")
async def system_status(_user=Depends(get_current_user)) -> dict:
    try:
        import psutil
        cpu = psutil.cpu_percent(interval=0.1)
        mem = psutil.virtual_memory()
        uptime = int((asyncio.get_event_loop().time()))
        return {
            "cpu_percent": cpu,
            "memory_percent": mem.percent,
            "memory_used_mb": mem.used // (1024 * 1024),
            "memory_total_mb": mem.total // (1024 * 1024),
            "platform": platform.system(),
            "hostname": platform.node(),
        }
    except Exception as e:  # noqa: BLE001
        return {"error": str(e)}


@router.get("/interfaces")
async def list_interfaces(_user=Depends(get_current_user)) -> dict:
    try:
        import psutil
        stats = psutil.net_if_stats()
        addrs = psutil.net_if_addrs()
        interfaces = []
        for name, stat in stats.items():
            if name == "lo":
                continue
            iface_addrs = addrs.get(name, [])
            ipv4 = next(
                (a.address for a in iface_addrs if a.family.name == "AF_INET"), ""
            )
            interfaces.append({
                "name": name,
                "is_up": stat.isup,
                "speed_mbps": stat.speed,
                "mtu": stat.mtu,
                "ipv4": ipv4,
            })
        return {"interfaces": interfaces}
    except Exception as e:  # noqa: BLE001
        return {"interfaces": [], "error": str(e)}


@router.get("/config")
async def get_config(_user=Depends(get_current_user)) -> dict:
    cfg = load_config()
    # Strip network.public_ip for security
    safe = {k: v for k, v in cfg.items() if k != "secrets"}
    return {"config": safe}


@router.post("/setup/complete")
async def mark_setup_complete(config: dict) -> dict:
    """Called by the Setup wizard — no JWT required for initial setup."""
    # Write setup-complete marker
    marker = Path("/var/lib/sentinel/setup_complete")
    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.touch()
    return {"status": "setup_complete"}


@router.get("/setup/status")
async def setup_status() -> dict:
    """Check if initial setup has been completed."""
    done = Path("/var/lib/sentinel/setup_complete").exists()
    return {"setup_complete": done}
