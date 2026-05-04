"""Port scanner using python-nmap with async job tracking."""
from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path

import aiofiles

logger = logging.getLogger("sentinel.scanner")

RESULTS_FILE = Path("/var/lib/sentinel/scans/last_scan.json")


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETE = "complete"
    FAILED = "failed"


@dataclass
class ScanJob:
    job_id: str
    target: str
    ports: str
    status: JobStatus = JobStatus.PENDING
    started_at: float = field(default_factory=time.time)
    finished_at: float | None = None
    result_count: int = 0
    error: str | None = None


_RISK_MAP = {
    "ssh": "medium",
    "telnet": "high",
    "ftp": "high",
    "http": "low",
    "https": "low",
    "rdp": "high",
    "vnc": "high",
    "mysql": "high",
    "postgresql": "high",
    "redis": "high",
    "mongodb": "high",
    "smtp": "medium",
    "dns": "low",
    "snmp": "medium",
}

_ACTION_MAP = {
    "high": "restrict_to_subnet",
    "medium": "review",
    "low": "allow",
}


class PortScanner:
    def __init__(self) -> None:
        self._jobs: dict[str, ScanJob] = {}

    async def scan_async(
        self, job_id: str, target: str, ports: str = "1-1024"
    ) -> None:
        job = ScanJob(job_id=job_id, target=target, ports=ports, status=JobStatus.RUNNING)
        self._jobs[job_id] = job

        try:
            results = await self._run_nmap(target, ports)
            job.result_count = len(results)
            job.status = JobStatus.COMPLETE
            job.finished_at = time.time()
            await self._cache_results(results)
            logger.info("Scan %s complete: %d open ports", job_id, len(results))
        except Exception as e:  # noqa: BLE001
            job.status = JobStatus.FAILED
            job.error = str(e)
            job.finished_at = time.time()
            logger.error("Scan %s failed: %s", job_id, e)

    async def _run_nmap(
        self, target: str, ports: str
    ) -> list[dict]:
        if not target:
            from backend.core.config import get_network_config
            net = get_network_config()
            target = net.get("lan_subnet", "192.168.1.0/24")

        cmd = ["nmap", "-sV", "-T4", "-oX", "-", target, "-p", ports]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"nmap failed: {stderr.decode()[:200]}")
        return self._parse_nmap_xml(stdout.decode())

    def _parse_nmap_xml(self, xml: str) -> list[dict]:
        import xml.etree.ElementTree as ET
        results = []
        try:
            root = ET.fromstring(xml)
            for host in root.findall("host"):
                addr = host.findtext("address[@addrtype='ipv4']", default="")
                if not addr:
                    addr_el = host.find("address")
                    addr = addr_el.get("addr", "") if addr_el is not None else ""
                for port_el in host.findall(".//port"):
                    state_el = port_el.find("state")
                    if state_el is None or state_el.get("state") != "open":
                        continue
                    service_el = port_el.find("service")
                    svc_name = service_el.get("name", "unknown") if service_el is not None else "unknown"
                    svc_ver = (
                        f"{service_el.get('product', '')} {service_el.get('version', '')}".strip()
                        if service_el is not None else ""
                    )
                    risk = _RISK_MAP.get(svc_name.lower(), "low")
                    results.append({
                        "host": addr,
                        "port": int(port_el.get("portid", 0)),
                        "protocol": port_el.get("protocol", "tcp"),
                        "service": svc_name,
                        "version": svc_ver,
                        "state": "open",
                        "risk_level": risk,
                        "suggested_action": _ACTION_MAP.get(risk, "review"),
                    })
        except ET.ParseError as e:
            logger.warning("nmap XML parse error: %s", e)
        return results

    async def _cache_results(self, results: list[dict]) -> None:
        RESULTS_FILE.parent.mkdir(parents=True, exist_ok=True)
        payload = {"timestamp": time.time(), "results": results}
        async with aiofiles.open(RESULTS_FILE, "w") as f:
            await f.write(json.dumps(payload, indent=2))

    async def get_latest_results(self) -> dict:
        if not RESULTS_FILE.exists():
            return {"timestamp": None, "results": [], "message": "No scan results yet"}
        async with aiofiles.open(RESULTS_FILE) as f:
            return json.loads(await f.read())

    def get_job_status(self, job_id: str) -> dict:
        job = self._jobs.get(job_id)
        if not job:
            return {"error": f"Job {job_id} not found"}
        return asdict(job)
