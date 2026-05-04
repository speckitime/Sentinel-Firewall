"""Unbound DNS manager."""
from __future__ import annotations

import asyncio
import re
from pathlib import Path

import aiofiles

from .config import load_config


class DNSManager:
    def _conf_path(self) -> Path:
        return Path(load_config()["dns"]["unbound_conf"])

    async def get_config(self) -> dict:
        cfg = load_config()["dns"]
        return {"forwarders": cfg.get("forwarders", []), "conf_path": cfg["unbound_conf"]}

    async def list_records(self) -> list[dict]:
        path = self._conf_path()
        if not path.exists():
            return []
        async with aiofiles.open(path) as f:
            content = await f.read()
        records: list[dict] = []
        for match in re.finditer(r'local-data:\s*"(\S+)\s+(\w+)\s+(\S+)"', content):
            records.append({"name": match.group(1), "type": match.group(2), "value": match.group(3)})
        return records

    async def add_record(self, name: str, record_type: str, value: str) -> None:
        path = self._conf_path()
        async with aiofiles.open(path, "a") as f:
            await f.write(f'  local-data: "{name} {record_type} {value}"\n')
        await self._reload()

    async def delete_record(self, name: str) -> None:
        path = self._conf_path()
        async with aiofiles.open(path) as f:
            lines = await f.readlines()
        filtered = [l for l in lines if f'"{name} ' not in l]
        async with aiofiles.open(path, "w") as f:
            await f.writelines(filtered)
        await self._reload()

    async def set_forwarders(self, forwarders: list[str]) -> None:
        path = self._conf_path()
        async with aiofiles.open(path) as f:
            content = await f.read()
        # Replace forward-zone block
        new_fwd = "forward-zone:\n  name: \".\"\n"
        new_fwd += "".join(f"  forward-addr: {ip}\n" for ip in forwarders)
        content = re.sub(r'forward-zone:.*', new_fwd, content, flags=re.DOTALL)
        async with aiofiles.open(path, "w") as f:
            await f.write(content)
        await self._reload()

    async def _reload(self) -> None:
        proc = await asyncio.create_subprocess_exec(
            "systemctl", "reload", "unbound",
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await proc.wait()
