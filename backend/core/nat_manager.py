"""NAT / port-forward manager."""
from __future__ import annotations

import ipaddress
from pathlib import Path
from typing import Any

import aiofiles

try:
    import tomllib
except ImportError:
    import tomli as tomllib  # type: ignore
import tomli_w

from .config import load_config
from .nftables import NFTABLES_CONF, NftablesManager


def _nat_toml_path() -> Path:
    from .config import _conf_dir
    return _conf_dir() / "nat.toml"


class NATManager:
    def __init__(self) -> None:
        self._nft = NftablesManager()

    async def load_port_forwards(self) -> list[dict]:
        path = _nat_toml_path()
        if not path.exists():
            return []
        async with aiofiles.open(path, "rb") as f:
            data = tomllib.loads((await f.read()).decode())
        return data.get("port_forwards", [])

    async def _save_port_forwards(self, forwards: list[dict]) -> None:
        path = _nat_toml_path()
        async with aiofiles.open(path, "wb") as f:
            await f.write(tomli_w.dumps({"port_forwards": forwards}).encode())

    def _validate(self, fwd: dict, existing: list[dict], skip_idx: int = -1) -> None:
        cfg = load_config()
        lan_subnet = ipaddress.ip_network(cfg["network"]["lan_subnet"], strict=False)
        try:
            ip = ipaddress.ip_address(fwd["internal_ip"])
        except ValueError:
            raise ValueError(f"Invalid IP: {fwd['internal_ip']}")
        if ip not in lan_subnet:
            raise ValueError(f"{ip} is not in LAN subnet {lan_subnet}")
        for i, e in enumerate(existing):
            if i == skip_idx:
                continue
            if e.get("external_port") == fwd["external_port"] and e.get("protocol") == fwd.get("protocol"):
                raise ValueError(f"Port {fwd['external_port']}/{fwd.get('protocol')} already in use")

    async def add_port_forward(self, fwd: dict) -> None:
        forwards = await self.load_port_forwards()
        self._validate(fwd, forwards)
        forwards.append(fwd)
        await self._save_port_forwards(forwards)
        await self.inject_dnat_rules()

    async def update_port_forward(self, idx: int, fwd: dict) -> None:
        forwards = await self.load_port_forwards()
        self._validate(fwd, forwards, skip_idx=idx)
        forwards[idx] = fwd
        await self._save_port_forwards(forwards)
        await self.inject_dnat_rules()

    async def delete_port_forward(self, idx: int) -> None:
        forwards = await self.load_port_forwards()
        forwards.pop(idx)
        await self._save_port_forwards(forwards)
        await self.inject_dnat_rules()

    async def inject_dnat_rules(self) -> None:
        async with aiofiles.open(NFTABLES_CONF) as f:
            conf = await f.read()
        forwards = await self.load_port_forwards()
        rules: list[str] = []
        for pf in forwards:
            if not pf.get("enabled", True):
                continue
            proto = pf.get("protocol", "tcp")
            ext_port  = pf["external_port"]
            lan_ip    = pf["internal_ip"]
            lan_port  = pf["internal_port"]
            if proto == "both":
                rules.append(f"tcp dport {ext_port} dnat to {lan_ip}:{lan_port}")
                rules.append(f"udp dport {ext_port} dnat to {lan_ip}:{lan_port}")
            else:
                rules.append(f"{proto} dport {ext_port} dnat to {lan_ip}:{lan_port}")
        new_conf = self._nft.inject_rules_between_markers(conf, "dnat", rules)
        async with aiofiles.open(NFTABLES_CONF, "w") as f:
            await f.write(new_conf)
        await self._nft.reload_from_file()

    async def set_masquerade(self, enabled: bool) -> None:
        cfg = load_config()
        lan_subnet = cfg["network"]["lan_subnet"]
        wan_if     = cfg["network"]["wan_interface"]
        async with aiofiles.open(NFTABLES_CONF) as f:
            conf = await f.read()
        rule = f'ip saddr {lan_subnet} oif "{wan_if}" masquerade' if enabled else ""
        new_conf = self._nft.inject_rules_between_markers(conf, "masquerade", [rule] if rule else [])
        async with aiofiles.open(NFTABLES_CONF, "w") as f:
            await f.write(new_conf)
        await self._nft.reload_from_file()
