"""WireGuard VPN routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.core.auth import get_current_user
from backend.core.wireguard import WireGuardManager

router = APIRouter(prefix="/vpn", tags=["vpn"])
_wg = WireGuardManager()


@router.get("/status")
async def vpn_status(_: dict = Depends(get_current_user)) -> dict:
    return await _wg.get_status()


@router.get("/peers")
async def list_peers(_: dict = Depends(get_current_user)) -> list[dict]:
    return await _wg.list_peers()


class PeerRequest(BaseModel):
    name: str
    allowed_ips: str = ""


@router.post("/peers")
async def add_peer(req: PeerRequest, _: dict = Depends(get_current_user)) -> dict:
    peer = await _wg.add_peer(req.name, req.allowed_ips)
    return peer


@router.delete("/peers/{public_key}")
async def remove_peer(public_key: str, _: dict = Depends(get_current_user)) -> dict:
    await _wg.remove_peer(public_key)
    return {"removed": public_key}


@router.get("/peers/{public_key}/qr")
async def peer_qr(public_key: str, _: dict = Depends(get_current_user)) -> dict:
    qr = await _wg.get_peer_qr(public_key)
    return {"qr_ascii": qr}
