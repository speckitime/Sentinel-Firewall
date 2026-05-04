"""Auto-response engine — confidence-based IP blocking."""
from __future__ import annotations

import asyncio
import logging
import time
from pathlib import Path

import aiofiles

from backend.core.config import load_config
from backend.core.nftables import NftablesManager
from backend.ids.suricata import SuricataMonitor

logger = logging.getLogger("sentinel.response")

RESPONSE_LOG = Path("/var/log/sentinel/response.log")


class ResponseEngine:
    """
    Confidence score thresholds:
    0-40:   Log only
    40-60:  Alert (broadcast to dashboard)
    60-80:  Rate-limit via nftables @rate_limited_ips
    80-100: Block via nftables @blocked_ips (requires auto_block=true)
    """

    def __init__(self) -> None:
        self._nft = NftablesManager()
        self._suricata = SuricataMonitor()

    async def evaluate_alert(self, alert: dict) -> None:
        config = load_config()
        ids_cfg = config.get("ids", {})
        auto_block: bool = ids_cfg.get("auto_block", False)
        threshold: int = ids_cfg.get("confidence_threshold", 80)

        confidence = alert.get("confidence", 0)
        src_ip = alert.get("src_ip", "")

        if not src_ip:
            return

        # Skip RFC1918 / loopback / VPN addresses (prevent self-blocking)
        if self._is_private_or_local(src_ip):
            return

        action = "log"
        if confidence >= threshold and auto_block:
            action = "block"
            try:
                await self._nft.add_to_set(
                    "inet sentinel_firewall", "blocked_ips", src_ip
                )
            except Exception as e:  # noqa: BLE001
                logger.error("Failed to block %s: %s", src_ip, e)
                action = "block_failed"
        elif confidence >= 60:
            action = "rate_limit"
            try:
                await self._nft.add_to_set(
                    "inet sentinel_firewall", "rate_limited_ips", src_ip
                )
            except Exception as e:  # noqa: BLE001
                logger.error("Failed to rate-limit %s: %s", src_ip, e)
        elif confidence >= 40:
            action = "alert"

        await self._audit_log(src_ip, confidence, action, alert.get("signature", ""))
        logger.info(
            "Response: %s | IP: %s | confidence: %d%% | action: %s",
            alert.get("signature", ""), src_ip, confidence, action,
        )

    async def _audit_log(self, ip: str, confidence: int, action: str, signature: str) -> None:
        RESPONSE_LOG.parent.mkdir(parents=True, exist_ok=True)
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        line = f"{timestamp}\t{ip}\t{confidence}\t{action}\t{signature}\n"
        async with aiofiles.open(RESPONSE_LOG, "a") as f:
            await f.write(line)

    def _is_private_or_local(self, ip: str) -> bool:
        import ipaddress
        try:
            addr = ipaddress.ip_address(ip)
            return addr.is_private or addr.is_loopback or addr.is_link_local
        except ValueError:
            return True

    async def run_forever(self) -> None:
        """Watch Suricata EVE log and respond to alerts."""
        logger.info("Response engine started")
        async for event in self._suricata.tail_eve_log():
            if event.get("event_type") == "alert":
                alert = {
                    "src_ip": event.get("src_ip", ""),
                    "signature": event.get("alert", {}).get("signature", ""),
                    "confidence": self._suricata.calculate_confidence(event),
                }
                await self.evaluate_alert(alert)
