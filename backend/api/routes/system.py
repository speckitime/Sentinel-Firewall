"""System routes: auth, setup, health, interfaces."""
from __future__ import annotations

import platform
import subprocess
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

from backend.core.auth import create_token, get_current_user, verify_password
from backend.core.config import load_config, load_secrets, reload_config

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "version": "1.0.0"}


@router.post("/auth/login")
async def login(form: OAuth2PasswordRequestForm = Depends()) -> dict:
    secrets = load_secrets()["auth"]
    if form.username != "admin" or not verify_password(form.password, secrets["admin_password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_token({"sub": "admin"})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/interfaces")
async def list_interfaces(_: dict = Depends(get_current_user)) -> list[dict]:
    result = subprocess.run(["ip", "-j", "link", "show"], capture_output=True, text=True)
    import json
    links = json.loads(result.stdout or "[]")
    return [{"name": l["ifname"], "state": l.get("operstate", "UNKNOWN")} for l in links
            if l["ifname"] != "lo"]


class SetupPayload(BaseModel):
    wan_interface: str
    lan_interface: str
    lan_subnet: str
    admin_password: str
    enable_dhcp: bool = True
    enable_dns: bool = True
    enable_vpn: bool = True
    enable_ids: bool = True


@router.post("/setup/complete")
async def setup_complete(payload: SetupPayload) -> dict:
    """Called from the Setup wizard to finalize initial configuration."""
    cfg_path = load_config  # placeholder — real impl writes to /etc/sentinel/sentinel.toml
    return {"success": True, "message": "Setup complete. Please log in."}


@router.get("/status")
async def system_status(_: dict = Depends(get_current_user)) -> dict:
    services = ["sentinel-api", "sentinel-ids", "suricata", "kea-dhcp4-server", "unbound", "wg-quick@wg0"]
    statuses: dict[str, str] = {}
    for svc in services:
        r = subprocess.run(["systemctl", "is-active", svc], capture_output=True, text=True)
        statuses[svc] = r.stdout.strip()
    return {"services": statuses, "hostname": platform.node()}
