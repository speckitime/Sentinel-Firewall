"""DHCP management routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.core.auth import get_current_user
from backend.core.dhcp_manager import DHCPManager

router = APIRouter(prefix="/dhcp", tags=["dhcp"])
_dhcp = DHCPManager()


@router.get("/leases")
async def list_leases(_: dict = Depends(get_current_user)) -> list[dict]:
    return await _dhcp.list_leases()


@router.get("/config")
async def get_config(_: dict = Depends(get_current_user)) -> dict:
    return await _dhcp.get_config()


class StaticLeaseRequest(BaseModel):
    mac: str
    ip: str
    hostname: str = ""


@router.post("/static")
async def add_static_lease(req: StaticLeaseRequest, _: dict = Depends(get_current_user)) -> dict:
    await _dhcp.add_static_lease(req.mac, req.ip, req.hostname)
    return {"ok": True}


@router.delete("/static/{mac}")
async def delete_static_lease(mac: str, _: dict = Depends(get_current_user)) -> dict:
    await _dhcp.delete_static_lease(mac)
    return {"deleted": mac}
