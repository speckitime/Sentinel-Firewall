"""Firewall rules API — nftables management."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.core.auth import get_current_user
from backend.core.nftables import NftablesManager

router = APIRouter()
_nft = NftablesManager()


class BlockRequest(BaseModel):
    ip: str
    timeout_minutes: int = 60


@router.get("/rules")
async def list_rules(_user=Depends(get_current_user)) -> dict:
    """Return current nftables ruleset as JSON."""
    try:
        return await _nft.list_rules()
    except Exception as e:  # noqa: BLE001
        return {"error": str(e), "rules": []}


@router.get("/sets")
async def list_sets(_user=Depends(get_current_user)) -> dict:
    """Return dynamic sets (blocked_ips, rate_limited_ips, vpn_clients)."""
    try:
        return await _nft.list_sets()
    except Exception as e:  # noqa: BLE001
        return {"error": str(e), "sets": {}}


@router.post("/block/{ip}")
async def block_ip(ip: str, _user=Depends(get_current_user)) -> dict:
    """Add IP to the @blocked_ips nftables set."""
    await _nft.add_to_set("inet sentinel_firewall", "blocked_ips", ip)
    return {"status": "blocked", "ip": ip}


@router.delete("/block/{ip}")
async def unblock_ip(ip: str, _user=Depends(get_current_user)) -> dict:
    """Remove IP from the @blocked_ips nftables set."""
    await _nft.delete_from_set("inet sentinel_firewall", "blocked_ips", ip)
    return {"status": "unblocked", "ip": ip}


@router.get("/stats")
async def firewall_stats(_user=Depends(get_current_user)) -> dict:
    """Return packet counters and drop statistics."""
    try:
        return await _nft.get_stats()
    except Exception as e:  # noqa: BLE001
        return {"error": str(e)}
