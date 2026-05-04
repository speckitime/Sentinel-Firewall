"""Port scanner using nmap subprocess."""
from __future__ import annotations

import asyncio
import json
import time
import uuid
from enum import Enum
from pathlib import Path
from typing import Any, Optional

import aiofiles

RESULTS_FILE = Path("/var/lib/sentinel/last_scan.json")

RISK_LEVELS = {
    "http": "medium", "ftp": "high", "telnet": "critical",
    "ssh": "low", "https": "low", "smtp": "medium",
    "rdp": "high", "vnc": "high", "mysql": "high",
    "mssql": "high", "mongodb": "high",
}


class ScanStatus(str, Enum):
    pending  = "pending"
    running  = "running"
    complete = "complete"
    failed   = "failed"


class PortScanner:
    def __init__(self) -> None:
        self._jobs: dict[str, dict] = {}

    def list_jobs(self) -> list[dict]:
        return list(self._jobs.values())

    def get_job(self, job_id: str) -> Optional[dict]:
        return self._jobs.get(job_id)

    async def start_scan(self, target: str, ports: str = "1-1024") -> str:
        job_id = str(uuid.uuid4())[:8]
        self._jobs[job_id] = {"id": job_id, "target": target, "ports": ports,
                              "status": ScanStatus.pending, "results": [], "started": time.time()}
        asyncio.create_task(self._run_scan(job_id, target, ports))
        return job_id

    async def _run_scan(self, job_id: str, target: str, ports: str) -> None:
        job = self._jobs[job_id]
        job["status"] = ScanStatus.running
        try:
            proc = await asyncio.create_subprocess_exec(
                "nmap", "-sV", "-T4", "--open", "-oX", "-", target, "-p", ports,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            stdout, _ = await proc.communicate()
            results = self._parse_xml(stdout.decode())
            job["results"] = results
            job["status"] = ScanStatus.complete
            job["finished"] = time.time()
            await self._cache_results(results)
        except Exception as exc:
            job["status"] = ScanStatus.failed
            job["error"] = str(exc)

    def _parse_xml(self, xml: str) -> list[dict]:
        import xml.etree.ElementTree as ET
        results: list[dict] = []
        try:
            root = ET.fromstring(xml)
        except ET.ParseError:
            return results
        for host in root.findall("host"):
            addr_el = host.find("address")
            ip = addr_el.attrib.get("addr", "") if addr_el is not None else ""
            for port_el in host.findall(".//port"):
                state_el  = port_el.find("state")
                service_el = port_el.find("service")
                port_num  = int(port_el.attrib.get("portid", 0))
                state     = state_el.attrib.get("state", "") if state_el is not None else ""
                service   = service_el.attrib.get("name", "") if service_el is not None else ""
                version   = ""
                if service_el is not None:
                    version = " ".join(filter(None, [
                        service_el.attrib.get("product", ""),
                        service_el.attrib.get("version", ""),
                    ]))
                risk = RISK_LEVELS.get(service.lower(), "unknown")
                results.append({
                    "ip": ip, "port": port_num,
                    "protocol": port_el.attrib.get("protocol", "tcp"),
                    "service": service, "version": version, "state": state,
                    "risk_level": risk,
                    "suggested_action": "restrict" if risk in ("high", "critical") else "monitor",
                })
        return results

    async def _cache_results(self, results: list[dict]) -> None:
        RESULTS_FILE.parent.mkdir(parents=True, exist_ok=True)
        async with aiofiles.open(RESULTS_FILE, "w") as f:
            await f.write(json.dumps({"timestamp": time.time(), "results": results}, indent=2))

    async def load_last_results(self) -> dict:
        if not RESULTS_FILE.exists():
            return {"timestamp": None, "results": []}
        async with aiofiles.open(RESULTS_FILE) as f:
            return json.loads(await f.read())
