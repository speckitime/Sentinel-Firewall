"""nftables abstraction layer — atomic rule management."""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import tempfile
from pathlib import Path

logger = logging.getLogger("sentinel.nftables")

NFTABLES_CONF = Path("/etc/nftables.conf")

# Marker pairs used for dynamic rule injection
MARKERS = {
    "input": ("# SENTINEL_INPUT_RULES_START", "# SENTINEL_INPUT_RULES_END"),
    "forward": ("# SENTINEL_FORWARD_RULES_START", "# SENTINEL_FORWARD_RULES_END"),
    "dnat": ("# SENTINEL_DNAT_START", "# SENTINEL_DNAT_END"),
    "masquerade": ("# SENTINEL_MASQUERADE_START", "# SENTINEL_MASQUERADE_END"),
}


class NftablesManager:
    async def _run_nft(self, *args: str) -> str:
        proc = await asyncio.create_subprocess_exec(
            "nft",
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"nft {' '.join(args)} failed: {stderr.decode().strip()}")
        return stdout.decode()

    async def apply_ruleset(self, content: str) -> None:
        """Write ruleset to a temp file and apply atomically."""
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".nft",
            prefix="sentinel_rules_",
            delete=False,
        ) as f:
            f.write(content)
            tmp_path = f.name
        try:
            await self._run_nft("-f", tmp_path)
            logger.info("nftables ruleset applied from %s", tmp_path)
        finally:
            os.unlink(tmp_path)

    async def reload_from_file(self) -> None:
        """Reload /etc/nftables.conf atomically."""
        await self._run_nft("-f", str(NFTABLES_CONF))

    async def add_to_set(
        self, table: str, set_name: str, element: str
    ) -> None:
        await self._run_nft(
            "add", "element", table, set_name, "{", element, "}"
        )
        logger.info("Added %s to set %s/%s", element, table, set_name)

    async def delete_from_set(
        self, table: str, set_name: str, element: str
    ) -> None:
        await self._run_nft(
            "delete", "element", table, set_name, "{", element, "}"
        )
        logger.info("Removed %s from set %s/%s", element, table, set_name)

    async def list_rules(self) -> dict:
        raw = await self._run_nft("list", "ruleset", "-j")
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"raw": raw}

    async def list_sets(self) -> dict:
        """Return elements of dynamic sets as dict."""
        try:
            raw = await self._run_nft("list", "ruleset", "-j")
            data = json.loads(raw)
            sets: dict[str, list] = {}
            for item in data.get("nftables", []):
                if "set" in item:
                    s = item["set"]
                    sets[s.get("name", "")] = [
                        e.get("elem", e) for e in s.get("elem", [])
                    ]
            return sets
        except Exception as e:  # noqa: BLE001
            return {"error": str(e)}

    async def get_stats(self) -> dict:
        """Return packet/byte counters from chain policies."""
        try:
            raw = await self._run_nft("list", "ruleset", "-j")
            data = json.loads(raw)
            counters: dict[str, dict] = {}
            for item in data.get("nftables", []):
                if "rule" in item:
                    rule = item["rule"]
                    for expr in rule.get("expr", []):
                        if "counter" in expr:
                            key = f"{rule.get('chain', '?')}/{rule.get('handle', '?')}"
                            counters[key] = expr["counter"]
            return {"counters": counters}
        except Exception as e:  # noqa: BLE001
            return {"error": str(e)}

    def inject_rules_between_markers(
        self, conf_content: str, marker_key: str, new_rules: list[str]
    ) -> str:
        """Replace content between marker comments with new_rules lines."""
        start_marker, end_marker = MARKERS[marker_key]
        pattern = re.compile(
            rf"({re.escape(start_marker)}).*?({re.escape(end_marker)})",
            re.DOTALL,
        )
        indented_rules = "\n".join(f"        {r}" for r in new_rules)
        replacement = f"\\1\n{indented_rules}\n        \\2" if new_rules else "\\1\n        \\2"
        result, count = pattern.subn(replacement, conf_content)
        if count == 0:
            raise ValueError(
                f"Markers not found in nftables.conf: '{start_marker}' / '{end_marker}'"
            )
        return result
