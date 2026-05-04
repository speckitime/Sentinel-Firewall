"""Threat / IDS routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from backend.core.auth import get_current_user
from backend.ids.response import ResponseEngine
from backend.ids.anomaly import AnomalyDetector

router = APIRouter(prefix="/threats", tags=["threats"])
_engine   = ResponseEngine()
_anomaly  = AnomalyDetector()


@router.get("/recent")
async def recent_threats(
    limit: int = Query(50, le=500),
    _: dict = Depends(get_current_user),
) -> list[dict]:
    return await _engine.get_recent_alerts(limit)


@router.get("/stats")
async def threat_stats(_: dict = Depends(get_current_user)) -> dict:
    return await _engine.get_stats()


@router.post("/block/{ip}")
async def manual_block(ip: str, _: dict = Depends(get_current_user)) -> dict:
    from backend.core.nftables import NftablesManager
    nft = NftablesManager()
    await nft.add_to_set("inet sentinel_firewall", "blocked_ips", ip)
    return {"blocked": ip}


@router.get("/anomaly/model")
async def anomaly_model_status(_: dict = Depends(get_current_user)) -> dict:
    return {"trained": _anomaly.is_trained, "samples": _anomaly.sample_count}
