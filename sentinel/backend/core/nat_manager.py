"""NAT / Port-Forwarding manager — reads/writes nat.toml and injects DNAT rules."""
from __future__ import annotations

import ipaddress
import logging
from pathlib import Path
from typing import Any

import aiofiles
import tomllib
import tomli_w

from backend.core.nftables import NftablesManager, NFTABLES_CONF

logger = logging.getLogger("sentinel.nat")

NAT_TOML_PATHS = [
    Path("/etc/sentinel/nat.toml"),
    Path(__file__).parent.parent.parent / "config" / "nat.toml",
]


def _nat_toml_path() -> Path:
    for p in NAT_TOML_PATHS:
        if p.exists():
            return p
    return NAT_TOML_PATHS[-1]


class NATManager:
    def __init__(self) -> None:
        self._nft = NftablesManager()

    async def load_port_forwards(self) -> list[dict]:
        path = _nat_toml_path()
        if not path.exists():
            return []
        async with aiofiles.open(path, "rb") as f:
            raw = await f.read()
        data = tomllib.loads(raw.decode())
        return data.get("port_forwards", [])

    async def _save_port_forwards(self, forwards: list[dict]) -> None:
        path = _nat_toml_path()
        # Preserve masquerade section
        if path.exists():
            async with aiofiles.open(path, "rb") as f:
                raw = await f.read()
            existing = tomllib.loads(raw.decode())
        else:
            existing = {}
        existing["port_forwards"] = forwards
        async with aiofiles.open(path, "wb") as f:
            await f.write(tomli_w.dumps(existing).encode())

    async def add_port_forward(self, pf: dict[str, Any]) -> None:
        forwards = await self.load_port_forwards()
        self._validate(pf, forwards)
        forwards.append(pf)
        await self._save_port_forwards(forwards)
        await self.inject_dnat_rules()

    async def update_port_forward(self, index: int, pf: dict[str, Any]) -> None:
        forwards = await self.load_port_forwards()
        if index < 0 or index >= len(forwards):
            raise IndexError(f"Port forward index {index} out of range")
        others = [f for i, f in enumerate(forwards) if i != index]
        self._validate(pf, others)
        forwards[index] = pf
        await self._save_port_forwards(forwards)
        await self.inject_dnat_rules()

    async def delete_port_forward(self, index: int) -> None:
        forwards = await self.load_port_forwards()
        if index < 0 or index >= len(forwards):
            raise IndexError(f"Port forward index {index} out of range")
        forwards.pop(index)
        await self._save_port_forwards(forwards)
        await self.inject_dnat_rules()

    async def inject_dnat_rules(self) -> None:
        """Rebuild DNAT rules in /etc/nftables.conf and reload."""
        if not NFTABLES_CONF.exists():
            logger.warning("nftables.conf not found; skipping DNAT injection")
            return
        async with aiofiles.open(NFTABLES_CONF) as f:
            conf = await f.read()

        forwards = await self.load_port_forwards()
        rules = []
        for pf in forwards:
            if not pf.get("enabled", True):
                continue
            proto = pf.get("protocol", "tcp")
            ext_port = pf["external_port"]
            lan_ip = pf["internal_ip"]
            lan_port = pf["internal_port"]
            if proto == "both":
                rules.append(f"tcp dport {ext_port} dnat to {lan_ip}:{lan_port}")
                rules.append(f"udp dport {ext_port} dnat to {lan_ip}:{lan_port}")
            else:
                rules.append(f"{proto} dport {ext_port} dnat to {lan_ip}:{lan_port}")

        try:
            new_conf = self._nft.inject_rules_between_markers(conf, "dnat", rules)
        except ValueError as e:
            logger.error("Cannot inject DNAT rules: %s", e)
            return

        async with aiofiles.open(NFTABLES_CONF, "w") as f:
            await f.write(new_conf)
        await self._nft.reload_from_file()
        logger.info("DNAT rules injected: %d active rules", len(rules))

    async def get_masquerade_status(self) -> dict:
        from backend.core.config import get_network_config
        net = get_network_config()
        return {
            "enabled": True,
            "wan_interface": net.get("wan_interface", ""),
            "lan_subnet": net.get("lan_subnet", ""),
            "public_ip": net.get("public_ip", ""),
        }

    async def set_masquerade(self, enabled: bool) -> None:
        # Masquerade is managed via the SENTINEL_MASQUERADE markers
        # Toggling is not yet implemented via API; controlled by installer
        logger.info("Masquerade toggle requested: %s", enabled)

    def _validate(self, pf: dict, existing: list[dict]) -> None:
        ext_port = pf["external_port"]
        proto = pf.get("protocol", "tcp")
        for existing_pf in existing:
            if existing_pf.get("external_port") == ext_port and (
                existing_pf.get("protocol", "tcp") == proto or proto == "both" or existing_pf.get("protocol") == "both"
            ):
                raise ValueError(f"External port {ext_port}/{proto} is already in use")
