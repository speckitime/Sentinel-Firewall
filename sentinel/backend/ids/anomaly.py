"""Simple traffic anomaly detection using sliding window baseline."""
from __future__ import annotations

import json
import logging
import time
from collections import deque
from pathlib import Path

import aiofiles

logger = logging.getLogger("sentinel.anomaly")

BASELINE_FILE = Path("/var/lib/sentinel/baseline.json")
_WINDOW_SIZE = 720  # 720 samples @ 2s = 24 hours


class AnomalyDetector:
    def __init__(self) -> None:
        self._rx_window: deque[float] = deque(maxlen=_WINDOW_SIZE)
        self._tx_window: deque[float] = deque(maxlen=_WINDOW_SIZE)
        self._loaded = False

    async def load_baseline(self) -> None:
        if not BASELINE_FILE.exists():
            return
        try:
            async with aiofiles.open(BASELINE_FILE) as f:
                data = json.loads(await f.read())
            self._rx_window = deque(data.get("rx", []), maxlen=_WINDOW_SIZE)
            self._tx_window = deque(data.get("tx", []), maxlen=_WINDOW_SIZE)
            self._loaded = True
        except Exception as e:  # noqa: BLE001
            logger.warning("Could not load baseline: %s", e)

    async def save_baseline(self) -> None:
        BASELINE_FILE.parent.mkdir(parents=True, exist_ok=True)
        async with aiofiles.open(BASELINE_FILE, "w") as f:
            await f.write(json.dumps({
                "rx": list(self._rx_window),
                "tx": list(self._tx_window),
                "updated": time.time(),
            }))

    def update(self, rx_bps: float, tx_bps: float) -> None:
        self._rx_window.append(rx_bps)
        self._tx_window.append(tx_bps)

    def score(self, rx_bps: float, tx_bps: float) -> float:
        """Return anomaly score 0.0–1.0 (higher = more anomalous)."""
        if len(self._rx_window) < 10:
            return 0.0  # Not enough baseline data
        avg_rx = sum(self._rx_window) / len(self._rx_window)
        avg_tx = sum(self._tx_window) / len(self._tx_window)
        if avg_rx == 0 and avg_tx == 0:
            return 0.0
        rx_ratio = rx_bps / max(avg_rx, 1)
        tx_ratio = tx_bps / max(avg_tx, 1)
        # Score spikes > 5x average as anomalous
        spike = max(rx_ratio, tx_ratio)
        if spike <= 2.0:
            return 0.0
        if spike >= 10.0:
            return 1.0
        return (spike - 2.0) / 8.0
