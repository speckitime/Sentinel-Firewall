"""Configuration loader with fallback for dev."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

try:
    import tomllib
except ImportError:
    import tomli as tomllib  # type: ignore

_SYSTEM_DIR = Path("/etc/sentinel")
_LOCAL_DIR  = Path(__file__).resolve().parents[2] / "config"


def _conf_dir() -> Path:
    return _SYSTEM_DIR if _SYSTEM_DIR.exists() else _LOCAL_DIR


@lru_cache(maxsize=1)
def load_config() -> dict[str, Any]:
    path = _conf_dir() / "sentinel.toml"
    with open(path, "rb") as f:
        return tomllib.load(f)


@lru_cache(maxsize=1)
def load_secrets() -> dict[str, Any]:
    path = _conf_dir() / "secrets.toml"
    with open(path, "rb") as f:
        return tomllib.load(f)


def reload_config() -> None:
    load_config.cache_clear()
    load_secrets.cache_clear()
