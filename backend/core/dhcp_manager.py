"""Kea DHCP manager — communicates via control agent on port 8001."""
from __future__ import annotations

import csv
import io
from pathlib import Path
from typing import Any

import aiohttp

from .config import load_config


class DHCPManager:
    def _ctrl_url(self) -> str:
        return load_config()["dhcp"]["kea_ctrl_url"]

    def _lease_file(self) -> Path:
        return Path(load_config()["dhcp"]["lease_file"])

    async def _kea_command(self, command: str, service: list[str], args: dict = None) -> Any:
        payload: dict = {"command": command, "service": service}
        if args:
            payload["arguments"] = args
        async with aiohttp.ClientSession() as session:
            async with session.post(self._ctrl_url(), json=payload, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                data = await resp.json()
                return data[0] if isinstance(data, list) else data

    async def list_leases(self) -> list[dict]:
        lease_file = self._lease_file()
        if not lease_file.exists():
            return []
        leases: list[dict] = []
        with open(lease_file) as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("state", "0") == "0":  # active leases
                    leases.append({
                        "ip": row.get("address", ""),
                        "mac": row.get("hwaddr", ""),
                        "hostname": row.get("hostname", ""),
                        "expires": row.get("expire", ""),
                    })
        return leases

    async def get_config(self) -> dict:
        try:
            result = await self._kea_command("config-get", ["dhcp4"])
            return result.get("arguments", {})
        except Exception as exc:
            return {"error": str(exc)}

    async def add_static_lease(self, mac: str, ip: str, hostname: str = "") -> None:
        await self._kea_command("lease4-add", ["dhcp4"], {
            "ip-address": ip, "hw-address": mac, "hostname": hostname,
        })

    async def delete_static_lease(self, mac: str) -> None:
        leases = await self.list_leases()
        for lease in leases:
            if lease["mac"] == mac:
                await self._kea_command("lease4-del", ["dhcp4"], {"ip-address": lease["ip"]})
                break
