"""NAT / port forwarding routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.core.auth import get_current_user
from backend.core.config import load_config
from backend.core.nat_manager import NATManager

router = APIRouter(prefix="/nat", tags=["nat"])
_nat = NATManager()


@router.get("/masquerade")
async def masquerade_status(_: dict = Depends(get_current_user)) -> dict:
    cfg = load_config()
    net = cfg.get("network", {})
    return {
        "enabled": True,
        "wan_interface": net.get("wan_interface", ""),
        "lan_subnet": net.get("lan_subnet", ""),
        "public_ip": net.get("public_ip", ""),
    }


@router.post("/masquerade")
async def set_masquerade(enabled: bool, _: dict = Depends(get_current_user)) -> dict:
    await _nat.set_masquerade(enabled)
    return {"enabled": enabled}


@router.get("/forwards")
async def list_forwards(_: dict = Depends(get_current_user)) -> list[dict]:
    return await _nat.load_port_forwards()


class PortForwardRequest(BaseModel):
    name: str
    protocol: str = "tcp"
    external_port: int
    internal_ip: str
    internal_port: int
    enabled: bool = True


@router.post("/forwards")
async def add_forward(req: PortForwardRequest, _: dict = Depends(get_current_user)) -> dict:
    fwd = req.model_dump()
    await _nat.add_port_forward(fwd)
    return fwd


@router.put("/forwards/{idx}")
async def update_forward(idx: int, req: PortForwardRequest, _: dict = Depends(get_current_user)) -> dict:
    fwd = req.model_dump()
    await _nat.update_port_forward(idx, fwd)
    return fwd


@router.delete("/forwards/{idx}")
async def delete_forward(idx: int, _: dict = Depends(get_current_user)) -> dict:
    await _nat.delete_port_forward(idx)
    return {"deleted": idx}
