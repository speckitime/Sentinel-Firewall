"""ML anomaly detector using Isolation Forest."""
from __future__ import annotations

import numpy as np


class AnomalyDetector:
    def __init__(self) -> None:
        self._model = None
        self._samples: list[list[float]] = []

    @property
    def is_trained(self) -> bool:
        return self._model is not None

    @property
    def sample_count(self) -> int:
        return len(self._samples)

    def add_sample(self, features: list[float]) -> None:
        self._samples.append(features)
        if len(self._samples) >= 100 and len(self._samples) % 50 == 0:
            self._train()

    def _train(self) -> None:
        try:
            from sklearn.ensemble import IsolationForest
            X = np.array(self._samples)
            self._model = IsolationForest(contamination=0.05, random_state=42)
            self._model.fit(X)
        except Exception:
            self._model = None

    def score(self, features: list[float]) -> float:
        """Returns anomaly score 0-100 (higher = more anomalous)."""
        if self._model is None:
            return 0.0
        x = np.array([features])
        raw = self._model.decision_function(x)[0]
        # Convert: decision_function returns negative for anomalies
        normalized = max(0.0, min(100.0, (1 - raw) * 50))
        return float(normalized)
