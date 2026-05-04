"""WireGuard VPN manager — key management, peer lifecycle, QR codes."""
from __future__ import annotations

import asyncio
import ipaddress
import logging
import re
from pathlib import Path

import aiofiles
import tomllib
import tomli_w

logger = logging.getLogger("sentinel.wireguard")

WG_CONF = Path("/etc/wireguard/wg0.conf")
WG_DIR = Path("/etc/wireguard")

WG_TOML_PATHS = [
    Path("/etc/sentinel/wireguard.toml"),
    Path(__file__).parent.parent.parent / "config" / "wireguard.toml",
]


def _wg_toml() -> Path:
    for p in WG_TOML_PATHS:
        if p.exists():
            return p
    return WG_TOML_PATHS[-1]


class WireGuardManager:
    async def _run(self, *cmd: str) -> str:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"{' '.join(cmd)}: {stderr.decode().strip()}")
        return stdout.decode().strip()

    async def get_status(self) -> dict:
        try:
            output = await self._run("wg", "show", "wg0", "dump")
            lines = output.strip().splitlines()
            if not lines:
                return {"interface": "wg0", "active": False}
            header = lines[0].split("\t")
            return {
                "interface": "wg0",
                "active": True,
                "public_key": header[1] if len(header) > 1 else "",
                "listen_port": header[2] if len(header) > 2 else "",
                "peer_count": len(lines) - 1,
            }
        except Exception as e:  # noqa: BLE001
            return {"interface": "wg0", "active": False, "error": str(e)}

    async def get_peers(self) -> list[dict]:
        try:
            output = await self._run("wg", "show", "wg0", "dump")
            lines = output.strip().splitlines()[1:]  # Skip server line
            peers = []
            for line in lines:
                parts = line.split("\t")
                if len(parts) >= 5:
                    peers.append({
                        "public_key": parts[0],
                        "preshared_key": parts[1] != "(none)",
                        "endpoint": parts[2],
                        "allowed_ips": parts[3],
                        "last_handshake": int(parts[4]),
                        "rx_bytes": int(parts[5]) if len(parts) > 5 else 0,
                        "tx_bytes": int(parts[6]) if len(parts) > 6 else 0,
                    })
            return peers
        except Exception:  # noqa: BLE001
            return []

    async def _next_peer_ip(self) -> str:
        """Assign next available IP in 10.8.0.0/24."""
        peers = await self.get_peers()
        used = {p["allowed_ips"].split("/")[0] for p in peers}
        used.add("10.8.0.1")  # Server IP
        for i in range(2, 255):
            candidate = f"10.8.0.{i}"
            if candidate not in used:
                return candidate
        raise RuntimeError("No available IP addresses in VPN subnet")

    async def add_peer(
        self, name: str, allowed_ips: str = "", keepalive: int = 25
    ) -> dict:
        # Generate keypair
        privkey = await self._run("wg", "genkey")
        pubkey = await asyncio.create_subprocess_exec(
            "wg", "pubkey",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await pubkey.communicate(input=privkey.encode())
        peer_pubkey = stdout.decode().strip()

        if not allowed_ips:
            peer_ip = await self._next_peer_ip()
            allowed_ips = f"{peer_ip}/32"

        # Add peer to running WireGuard interface
        try:
            await self._run(
                "wg", "set", "wg0",
                "peer", peer_pubkey,
                "allowed-ips", allowed_ips,
                "persistent-keepalive", str(keepalive),
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("wg set failed (wg0 may not be running): %s", e)

        # Persist peer in wg0.conf
        await self._append_peer_to_conf(name, peer_pubkey, allowed_ips, keepalive)

        # Save private key for QR generation
        WG_DIR.mkdir(parents=True, exist_ok=True)
        key_file = WG_DIR / f"peer_{name}.privkey"
        key_file.write_text(privkey)
        key_file.chmod(0o600)

        return {
            "name": name,
            "public_key": peer_pubkey,
            "allowed_ips": allowed_ips,
            "private_key": privkey,  # Only returned on creation
        }

    async def _append_peer_to_conf(self, name: str, pubkey: str, allowed_ips: str, keepalive: int) -> None:
        peer_block = (
            f"\n# Peer: {name}\n"
            f"[Peer]\n"
            f"PublicKey = {pubkey}\n"
            f"AllowedIPs = {allowed_ips}\n"
            f"PersistentKeepalive = {keepalive}\n"
        )
        if WG_CONF.exists():
            async with aiofiles.open(WG_CONF) as f:
                content = await f.read()
            # Insert before END marker if present
            if "# SENTINEL-PEERS-END" in content:
                content = content.replace("# SENTINEL-PEERS-END", peer_block + "# SENTINEL-PEERS-END")
            else:
                content += peer_block
            async with aiofiles.open(WG_CONF, "w") as f:
                await f.write(content)

    async def remove_peer(self, name: str) -> None:
        """Remove peer from wg0 and wg0.conf."""
        # Find pubkey by name from conf
        if WG_CONF.exists():
            async with aiofiles.open(WG_CONF) as f:
                content = await f.read()
            # Remove peer block matching name comment
            new_content = re.sub(
                rf"\n# Peer: {re.escape(name)}\n\[Peer\].*?(?=\n# Peer:|\n\[Interface\]|$)",
                "",
                content,
                flags=re.DOTALL,
            )
            async with aiofiles.open(WG_CONF, "w") as f:
                await f.write(new_content)

    async def get_peer_config(self, name: str) -> str:
        """Generate client WireGuard config string."""
        key_file = WG_DIR / f"peer_{name}.privkey"
        if not key_file.exists():
            raise FileNotFoundError(f"Private key for peer '{name}' not found")
        privkey = key_file.read_text().strip()

        server_pubkey_file = WG_DIR / "server_public.key"
        server_pubkey = server_pubkey_file.read_text().strip() if server_pubkey_file.exists() else ""

        from backend.core.config import get_network_config
        net = get_network_config()
        public_ip = net.get("public_ip", "SERVER_IP")

        return (
            f"[Interface]\n"
            f"PrivateKey = {privkey}\n"
            f"Address = 10.8.0.X/24\n"
            f"DNS = 1.1.1.1\n\n"
            f"[Peer]\n"
            f"PublicKey = {server_pubkey}\n"
            f"AllowedIPs = 0.0.0.0/0\n"
            f"Endpoint = {public_ip}:51820\n"
            f"PersistentKeepalive = 25\n"
        )

    async def generate_qr(self, name: str) -> bytes:
        config = await self.get_peer_config(name)
        proc = await asyncio.create_subprocess_exec(
            "qrencode", "-t", "PNG", "-o", "-",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate(input=config.encode())
        return stdout
