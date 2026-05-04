"""Port scanner routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.core.auth import get_current_user
from backend.core.port_scanner import PortScanner

router = APIRouter(prefix="/scanner", tags=["scanner"])
_scanner = PortScanner()


@router.get("/status")
async def scanner_status(_: dict = Depends(get_current_user)) -> dict:
    return {"jobs": _scanner.list_jobs()}


class ScanRequest(BaseModel):
    target: str
    ports: str = "1-1024"


@router.post("/scan")
async def start_scan(req: ScanRequest, _: dict = Depends(get_current_user)) -> dict:
    job_id = await _scanner.start_scan(req.target, req.ports)
    return {"job_id": job_id}


@router.get("/scan/{job_id}")
async def get_scan(job_id: str, _: dict = Depends(get_current_user)) -> dict:
    job = _scanner.get_job(job_id)
    if job is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/last")
async def last_results(_: dict = Depends(get_current_user)) -> dict:
    return await _scanner.load_last_results()
