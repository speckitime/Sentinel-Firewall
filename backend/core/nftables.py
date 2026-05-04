"""nftables manager — atomic rule application via temp file."""
from __future__ import annotations

import asyncio
import os
import re
import tempfile

NFTABLES_CONF = "/etc/nftables.conf"

MARKERS = {
    "input":      ("# SENTINEL_INPUT_RULES_START",   "# SENTINEL_INPUT_RULES_END"),
    "forward":    ("# SENTINEL_FORWARD_RULES_START", "# SENTINEL_FORWARD_RULES_END"),
    "dnat":       ("# SENTINEL_DNAT_START",          "# SENTINEL_DNAT_END"),
    "masquerade": ("# SENTINEL_MASQUERADE_START",    "# SENTINEL_MASQUERADE_END"),
}


class NftablesManager:
    async def _run_nft(self, *args: str) -> str:
        proc = await asyncio.create_subprocess_exec(
            "nft", *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(
                f"nft {' '.join(args)} exited {proc.returncode}: {stderr.decode().strip()}"
            )
        return stdout.decode()

    async def apply_ruleset(self, content: str) -> None:
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".nft", prefix="sentinel_rules_", delete=False
        ) as f:
            f.write(content)
            tmp_path = f.name
        try:
            await self._run_nft("-f", tmp_path)
        finally:
            os.unlink(tmp_path)

    async def reload_from_file(self) -> None:
        await self._run_nft("-f", NFTABLES_CONF)

    async def add_to_set(self, table: str, set_name: str, element: str) -> None:
        await self._run_nft("add", "element", table, set_name, "{", element, "}")

    async def delete_from_set(self, table: str, set_name: str, element: str) -> None:
        await self._run_nft("delete", "element", table, set_name, "{", element, "}")

    async def list_rules(self) -> dict:
        import json
        out = await self._run_nft("list", "ruleset", "-j")
        return json.loads(out)

    def inject_rules_between_markers(self, conf: str, section: str, rules: list[str]) -> str:
        """Replace content between SENTINEL marker comments for `section`."""
        if section not in MARKERS:
            raise ValueError(f"Unknown section '{section}'. Valid: {list(MARKERS)}")

        start_marker, end_marker = MARKERS[section]

        if start_marker not in conf or end_marker not in conf:
            raise ValueError(
                f"nftables.conf is missing required markers for section '{section}'.\n"
                f"  Expected: '{start_marker}' and '{end_marker}'\n"
                f"  File: {NFTABLES_CONF}\n"
                f"  Reinstall or restore the config with: sudo nft -f /etc/nftables.conf"
            )

        rules_text = "\n".join(f"    {r}" for r in rules)
        pattern = re.compile(
            re.escape(start_marker) + r".*?" + re.escape(end_marker),
            re.DOTALL,
        )
        replacement = f"{start_marker}\n{rules_text}\n    {end_marker}"
        return pattern.sub(replacement, conf)
