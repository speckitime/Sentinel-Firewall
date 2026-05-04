"""IDS/IPS Threats and alert management API."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from backend.core.auth import get_current_user
from backend.ids.suricata import SuricataMonitor
from backend.core.nftables import NftablesManager

router = APIRouter()
_suricata = SuricataMonitor()
_nft = NftablesManager()


@router.get("/alerts")
async def get_alerts(
    limit: int = Query(default=100, ge=1, le=1000),
    _user=Depends(get_current_user),
) -> dict:
    alerts = await _suricata.get_recent_alerts(limit=limit)
    return {"alerts": alerts, "count": len(alerts)}


@router.get("/alerts/{alert_id}")
async def get_alert(alert_id: str, _user=Depends(get_current_user)) -> dict:
    alert = await _suricata.get_alert_by_id(alert_id)
    return {"alert": alert}


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, _user=Depends(get_current_user)) -> dict:
    await _suricata.acknowledge_alert(alert_id)
    return {"status": "acknowledged", "alert_id": alert_id}


@router.get("/blocked")
async def get_blocked_ips(_user=Depends(get_current_user)) -> dict:
    try:
        sets = await _nft.list_sets()
        blocked = sets.get("blocked_ips", [])
    except Exception:  # noqa: BLE001
        blocked = []
    return {"blocked_ips": blocked}


@router.delete("/blocked/{ip}")
async def unblock_ip(ip: str, _user=Depends(get_current_user)) -> dict:
    await _nft.delete_from_set("inet sentinel_firewall", "blocked_ips", ip)
    return {"status": "unblocked", "ip": ip}
