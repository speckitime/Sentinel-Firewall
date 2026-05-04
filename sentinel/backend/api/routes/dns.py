"""DNS configuration API (Unbound)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.core.auth import get_current_user
from backend.core.dns_manager import DNSManager

router = APIRouter()
_dns = DNSManager()


class LocalZone(BaseModel):
    name: str
    ip: str
    zone_type: str = "static"


@router.get("/config")
async def get_config(_user=Depends(get_current_user)) -> dict:
    return await _dns.get_config()


@router.put("/config")
async def update_config(config: dict, _user=Depends(get_current_user)) -> dict:
    await _dns.update_config(config)
    return {"status": "updated"}


@router.get("/zones")
async def list_zones(_user=Depends(get_current_user)) -> dict:
    zones = await _dns.list_zones()
    return {"zones": zones}


@router.post("/zones")
async def add_zone(zone: LocalZone, _user=Depends(get_current_user)) -> dict:
    await _dns.add_local_zone(zone.name, zone.ip)
    return {"status": "created", "zone": zone.model_dump()}


@router.delete("/zones/{name}")
async def delete_zone(name: str, _user=Depends(get_current_user)) -> dict:
    await _dns.delete_zone(name)
    return {"status": "deleted", "name": name}
