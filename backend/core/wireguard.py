"""WireGuard peer management."""
from __future__ import annotations

import asyncio
import ipaddress
import re
from pathlib import Path

import aiofiles

from .config import load_config


class WireGuardManager:
    def _wg_conf(self) -> Path:
        return Path(load_config()["vpn"]["wg_conf"])

    async def get_status(self) -> dict:
        proc = await asyncio.create_subprocess_exec(
            "wg", "show", "wg0",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
        )
        out, _ = await proc.communicate()
        return {"raw": out.decode(), "up": proc.returncode == 0}

    async def list_peers(self) -> list[dict]:
        async with aiofiles.open(self._wg_conf()) as f:
            content = await f.read()
        peers: list[dict] = []
        for block in re.findall(r'\[Peer\](.*?)(?=\[Peer\]|\Z)', content, re.DOTALL):
            peer: dict[str, str] = {}
            for line in block.splitlines():
                line = line.strip()
                if "=" in line:
                    k, _, v = line.partition("=")
                    peer[k.strip().lower().replace("-", "_")] = v.strip()
            if peer:
                peers.append(peer)
        return peers

    async def _next_peer_ip(self) -> str:
        peers = await self.list_peers()
        used = set()
        for p in peers:
            ai = p.get("allowed_ips", "")
            for ip_net in ai.split(","):
                try:
                    used.add(str(ipaddress.ip_interface(ip_net.strip()).ip))
                except ValueError:
                    pass
        base = ipaddress.ip_network("10.8.0.0/24")
        for host in base.hosts():
            if str(host) not in used and str(host) != "10.8.0.1":
                return str(host)
        raise RuntimeError("No available peer IPs")

    async def add_peer(self, name: str, allowed_ips: str = "") -> dict:
        priv = await self._generate_key()
        pub  = await self._pubkey(priv)
        psk  = await self._generate_psk()
        peer_ip = await self._next_peer_ip()
        if not allowed_ips:
            allowed_ips = f"{peer_ip}/32"
        cfg = load_config()
        peer_block = (
            f"\n# {name}\n"
            f"[Peer]\n"
            f"PublicKey = {pub}\n"
            f"PresharedKey = {psk}\n"
            f"AllowedIPs = {allowed_ips}\n"
        )
        async with aiofiles.open(self._wg_conf(), "a") as f:
            await f.write(peer_block)
        # Sync live interface
        proc = await asyncio.create_subprocess_exec(
            "wg", "set", "wg0", "peer", pub, "preshared-key", "/dev/stdin",
            "allowed-ips", allowed_ips,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await proc.communicate(psk.encode())
        return {"name": name, "public_key": pub, "private_key": priv,
                "preshared_key": psk, "allowed_ips": allowed_ips,
                "peer_ip": peer_ip,
                "server_public": await self._get_server_pubkey(),
                "server_endpoint": f"{cfg['network'].get('public_ip', '')}:{cfg['vpn']['listen_port']}",
                "dns": cfg['vpn']['dns_server']}

    async def remove_peer(self, public_key: str) -> None:
        async with aiofiles.open(self._wg_conf()) as f:
            content = await f.read()
        content = re.sub(
            r'\n?#.*?\n\[Peer\].*?PublicKey = ' + re.escape(public_key) + r'.*?(?=\n\[|\Z)',
            '', content, flags=re.DOTALL
        )
        async with aiofiles.open(self._wg_conf(), "w") as f:
            await f.write(content)
        proc = await asyncio.create_subprocess_exec(
            "wg", "set", "wg0", "peer", public_key, "remove",
            stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
        )
        await proc.wait()

    async def get_peer_qr(self, public_key: str) -> str:
        peers = await self.list_peers()
        for p in peers:
            if p.get("public_key") == public_key:
                client_conf = f"[Interface]\nPrivateKey = <client_private_key>\nAddress = {p.get('allowed_ips', '')}\nDNS = {load_config()['vpn']['dns_server']}\n\n[Peer]\nPublicKey = {await self._get_server_pubkey()}\nEndpoint = <server_ip>:{load_config()['vpn']['listen_port']}\nAllowedIPs = 0.0.0.0/0\n"
                proc = await asyncio.create_subprocess_exec(
                    "qrencode", "-t", "ANSI",
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                )
                out, _ = await proc.communicate(client_conf.encode())
                return out.decode()
        return ""

    async def _get_server_pubkey(self) -> str:
        async with aiofiles.open(self._wg_conf()) as f:
            content = await f.read()
        m = re.search(r'PrivateKey\s*=\s*(\S+)', content)
        if not m:
            return ""
        return await self._pubkey(m.group(1))

    async def _generate_key(self) -> str:
        proc = await asyncio.create_subprocess_exec("wg", "genkey", stdout=asyncio.subprocess.PIPE)
        out, _ = await proc.communicate()
        return out.decode().strip()

    async def _pubkey(self, private: str) -> str:
        proc = await asyncio.create_subprocess_exec(
            "wg", "pubkey", stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE
        )
        out, _ = await proc.communicate(private.encode())
        return out.decode().strip()

    async def _generate_psk(self) -> str:
        proc = await asyncio.create_subprocess_exec("wg", "genpsk", stdout=asyncio.subprocess.PIPE)
        out, _ = await proc.communicate()
        return out.decode().strip()
