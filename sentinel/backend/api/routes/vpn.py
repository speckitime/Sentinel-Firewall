"""WireGuard VPN management API."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from pydantic import BaseModel

from backend.core.auth import get_current_user
from backend.core.wireguard import WireGuardManager

router = APIRouter()
_wg = WireGuardManager()


class NewPeer(BaseModel):
    name: str
    allowed_ips: str = ""  # Auto-assigned if empty
    persistent_keepalive: int = 25


@router.get("/status")
async def vpn_status(_user=Depends(get_current_user)) -> dict:
    return await _wg.get_status()


@router.get("/peers")
async def list_peers(_user=Depends(get_current_user)) -> dict:
    peers = await _wg.get_peers()
    return {"peers": peers}


@router.post("/peers")
async def add_peer(peer: NewPeer, _user=Depends(get_current_user)) -> dict:
    result = await _wg.add_peer(peer.name, peer.allowed_ips, peer.persistent_keepalive)
    return {"status": "created", "peer": result}


@router.delete("/peers/{name}")
async def remove_peer(name: str, _user=Depends(get_current_user)) -> dict:
    await _wg.remove_peer(name)
    return {"status": "deleted", "name": name}


@router.get("/peers/{name}/qr")
async def peer_qr_code(name: str, _user=Depends(get_current_user)) -> Response:
    png_bytes = await _wg.generate_qr(name)
    return Response(content=png_bytes, media_type="image/png")


@router.get("/peers/{name}/config")
async def peer_config(name: str, _user=Depends(get_current_user)) -> dict:
    config_text = await _wg.get_peer_config(name)
    return {"config": config_text}
