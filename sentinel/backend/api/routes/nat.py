"""NAT and Port Forwarding API."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.core.auth import get_current_user
from backend.core.nat_manager import NATManager

router = APIRouter()
_nat = NATManager()


class PortForward(BaseModel):
    name: str
    description: str = ""
    protocol: str = Field(default="tcp", pattern="^(tcp|udp|both)$")
    external_port: int = Field(ge=1, le=65535)
    internal_ip: str
    internal_port: int = Field(ge=1, le=65535)
    enabled: bool = True


@router.get("/port-forwards")
async def list_port_forwards(_user=Depends(get_current_user)) -> dict:
    forwards = await _nat.load_port_forwards()
    return {"port_forwards": forwards}


@router.post("/port-forwards")
async def add_port_forward(pf: PortForward, _user=Depends(get_current_user)) -> dict:
    await _nat.add_port_forward(pf.model_dump())
    return {"status": "created", "rule": pf.model_dump()}


@router.put("/port-forwards/{index}")
async def update_port_forward(
    index: int, pf: PortForward, _user=Depends(get_current_user)
) -> dict:
    await _nat.update_port_forward(index, pf.model_dump())
    return {"status": "updated", "rule": pf.model_dump()}


@router.delete("/port-forwards/{index}")
async def delete_port_forward(index: int, _user=Depends(get_current_user)) -> dict:
    await _nat.delete_port_forward(index)
    return {"status": "deleted", "index": index}


@router.get("/masquerade")
async def masquerade_status(_user=Depends(get_current_user)) -> dict:
    return await _nat.get_masquerade_status()


@router.put("/masquerade")
async def set_masquerade(
    enabled: bool, _user=Depends(get_current_user)
) -> dict:
    await _nat.set_masquerade(enabled)
    return {"status": "updated", "enabled": enabled}
