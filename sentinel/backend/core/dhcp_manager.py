"""ISC Kea DHCP manager — communicates via Kea Control Agent (port 8001)."""
from __future__ import annotations

import logging

import httpx

logger = logging.getLogger("sentinel.dhcp")

# Kea Control Agent runs on 8001 to avoid conflict with Sentinel API on 8000
KEA_CTRL_URL = "http://127.0.0.1:8001/"


class DHCPManager:
    async def _kea_command(self, command: str, service: str = "dhcp4", args: dict | None = None) -> dict:
        payload: dict = {"command": command, "service": [service]}
        if args is not None:
            payload["arguments"] = args
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(KEA_CTRL_URL, json=payload)
                resp.raise_for_status()
                data = resp.json()
                if isinstance(data, list) and data:
                    return data[0]
                return data
        except Exception as e:  # noqa: BLE001
            logger.error("Kea command '%s' failed: %s", command, e)
            return {"result": -1, "text": str(e)}

    async def get_leases(self) -> list[dict]:
        result = await self._kea_command("lease4-get-all")
        leases_raw = result.get("arguments", {}).get("leases", [])
        return [
            {
                "ip": lease.get("ip-address", ""),
                "mac": lease.get("hw-address", ""),
                "hostname": lease.get("hostname", ""),
                "expires": lease.get("expire", 0),
                "state": lease.get("state", 0),
            }
            for lease in leases_raw
        ]

    async def get_config(self) -> dict:
        result = await self._kea_command("config-get")
        return result.get("arguments", {})

    async def update_config(self, config: dict) -> None:
        await self._kea_command("config-set", args=config)
        await self._kea_command("config-write")

    async def add_static_reservation(self, mac: str, ip: str, hostname: str) -> None:
        args = {
            "reservation": {
                "hw-address": mac,
                "ip-address": ip,
                "hostname": hostname,
                "subnet-id": 1,
            }
        }
        await self._kea_command("reservation-add", args=args)

    async def delete_static_reservation(self, mac: str) -> None:
        args = {"identifier-type": "hw-address", "identifier": mac, "subnet-id": 1}
        await self._kea_command("reservation-del", args=args)
