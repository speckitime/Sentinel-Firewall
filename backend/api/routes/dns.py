"""DNS management routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.core.auth import get_current_user
from backend.core.dns_manager import DNSManager

router = APIRouter(prefix="/dns", tags=["dns"])
_dns = DNSManager()


@router.get("/config")
async def get_config(_: dict = Depends(get_current_user)) -> dict:
    return await _dns.get_config()


@router.get("/records")
async def list_records(_: dict = Depends(get_current_user)) -> list[dict]:
    return await _dns.list_records()


class DNSRecordRequest(BaseModel):
    name: str
    record_type: str = "A"
    value: str


@router.post("/records")
async def add_record(req: DNSRecordRequest, _: dict = Depends(get_current_user)) -> dict:
    await _dns.add_record(req.name, req.record_type, req.value)
    return {"ok": True}


@router.delete("/records/{name}")
async def delete_record(name: str, _: dict = Depends(get_current_user)) -> dict:
    await _dns.delete_record(name)
    return {"deleted": name}


@router.post("/forwarders")
async def set_forwarders(forwarders: list[str], _: dict = Depends(get_current_user)) -> dict:
    await _dns.set_forwarders(forwarders)
    return {"forwarders": forwarders}
