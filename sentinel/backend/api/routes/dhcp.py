"""DHCP leases and subnet management API."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.core.auth import get_current_user
from backend.core.dhcp_manager import DHCPManager

router = APIRouter()
_dhcp = DHCPManager()


class StaticReservation(BaseModel):
    mac: str
    ip: str
    hostname: str = ""


@router.get("/leases")
async def get_leases(_user=Depends(get_current_user)) -> dict:
    leases = await _dhcp.get_leases()
    return {"leases": leases}


@router.get("/config")
async def get_config(_user=Depends(get_current_user)) -> dict:
    config = await _dhcp.get_config()
    return {"config": config}


@router.put("/config")
async def update_config(config: dict, _user=Depends(get_current_user)) -> dict:
    await _dhcp.update_config(config)
    return {"status": "updated"}


@router.post("/static")
async def add_static_reservation(
    reservation: StaticReservation, _user=Depends(get_current_user)
) -> dict:
    await _dhcp.add_static_reservation(reservation.mac, reservation.ip, reservation.hostname)
    return {"status": "created", "reservation": reservation.model_dump()}


@router.delete("/static/{mac}")
async def delete_static_reservation(mac: str, _user=Depends(get_current_user)) -> dict:
    await _dhcp.delete_static_reservation(mac)
    return {"status": "deleted", "mac": mac}
