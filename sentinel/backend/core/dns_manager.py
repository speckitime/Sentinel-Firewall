"""Unbound DNS manager — manages sentinel.conf and reloads Unbound."""
from __future__ import annotations

import asyncio
import logging
import re
from pathlib import Path

import aiofiles

logger = logging.getLogger("sentinel.dns")

UNBOUND_CONF = Path("/etc/unbound/unbound.conf.d/sentinel.conf")


class DNSManager:
    async def get_config(self) -> dict:
        if not UNBOUND_CONF.exists():
            return {"config": "", "zones": []}
        async with aiofiles.open(UNBOUND_CONF) as f:
            content = await f.read()
        zones = self._parse_local_data(content)
        return {"config": content, "zones": zones}

    async def update_config(self, config: dict) -> None:
        content = config.get("config", "")
        async with aiofiles.open(UNBOUND_CONF, "w") as f:
            await f.write(content)
        await self.reload()

    async def list_zones(self) -> list[dict]:
        cfg = await self.get_config()
        return cfg.get("zones", [])

    async def add_local_zone(self, name: str, ip: str) -> None:
        if not UNBOUND_CONF.exists():
            logger.warning("Unbound sentinel.conf not found")
            return
        async with aiofiles.open(UNBOUND_CONF) as f:
            content = await f.read()
        entry = f'    local-data: "{name}. A {ip}"\n'
        if entry.strip() not in content:
            # Append before the last closing brace or at end
            content = content.rstrip() + "\n" + entry
            async with aiofiles.open(UNBOUND_CONF, "w") as f:
                await f.write(content)
            await self.reload()

    async def delete_zone(self, name: str) -> None:
        if not UNBOUND_CONF.exists():
            return
        async with aiofiles.open(UNBOUND_CONF) as f:
            content = await f.read()
        # Remove matching local-data lines
        new_content = re.sub(
            rf'\s*local-data:\s*"{re.escape(name)}\..*?"\n', "", content
        )
        async with aiofiles.open(UNBOUND_CONF, "w") as f:
            await f.write(new_content)
        await self.reload()

    async def reload(self) -> None:
        proc = await asyncio.create_subprocess_exec(
            "systemctl", "reload", "unbound",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()

    def _parse_local_data(self, content: str) -> list[dict]:
        zones = []
        for match in re.finditer(
            r'local-data:\s*"([^"]+)\.\s+A\s+([^"]+)"', content
        ):
            zones.append({"name": match.group(1), "ip": match.group(2)})
        return zones
