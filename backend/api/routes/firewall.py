"""Firewall rules routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.core.auth import get_current_user
from backend.core.nftables import NftablesManager

router = APIRouter(prefix="/firewall", tags=["firewall"])
_nft = NftablesManager()


@router.get("/rules")
async def list_rules(_: dict = Depends(get_current_user)) -> dict:
    return await _nft.list_rules()


class BlockIPRequest(BaseModel):
    ip: str
    reason: str = ""


@router.post("/block")
async def block_ip(req: BlockIPRequest, _: dict = Depends(get_current_user)) -> dict:
    await _nft.add_to_set("inet sentinel_firewall", "blocked_ips", req.ip)
    return {"blocked": req.ip}


@router.delete("/block/{ip}")
async def unblock_ip(ip: str, _: dict = Depends(get_current_user)) -> dict:
    await _nft.delete_from_set("inet sentinel_firewall", "blocked_ips", ip)
    return {"unblocked": ip}


@router.get("/blocked")
async def list_blocked(_: dict = Depends(get_current_user)) -> list[str]:
    rules = await _nft.list_rules()
    sets = rules.get("nftables", [])
    for item in sets:
        if isinstance(item, dict) and "set" in item:
            s = item["set"]
            if s.get("name") == "blocked_ips":
                return [e.get("elem", e) for e in s.get("elem", [])]
    return []
