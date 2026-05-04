"""Port scanner API."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, BackgroundTasks
from pydantic import BaseModel

from backend.core.auth import get_current_user
from backend.core.port_scanner import PortScanner

router = APIRouter()
_scanner = PortScanner()


class ScanRequest(BaseModel):
    target: str = ""
    ports: str = "1-1024"


@router.get("/latest")
async def get_latest_scan(_user=Depends(get_current_user)) -> dict:
    return await _scanner.get_latest_results()


@router.post("/scan")
async def start_scan(
    req: ScanRequest,
    background_tasks: BackgroundTasks,
    _user=Depends(get_current_user),
) -> dict:
    job_id = str(uuid.uuid4())
    background_tasks.add_task(_scanner.scan_async, job_id, req.target, req.ports)
    return {"job_id": job_id, "status": "started"}


@router.get("/scan/{job_id}")
async def scan_status(job_id: str, _user=Depends(get_current_user)) -> dict:
    return _scanner.get_job_status(job_id)
