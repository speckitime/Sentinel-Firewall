"""Configuration loader for Sentinel."""
from __future__ import annotations

import tomllib
from functools import lru_cache
from pathlib import Path

CONFIG_PATHS = [
    Path("/etc/sentinel/sentinel.toml"),
    Path(__file__).parent.parent.parent / "config" / "sentinel.toml",
]
SECRETS_PATHS = [
    Path("/etc/sentinel/secrets.toml"),
    Path(__file__).parent.parent.parent / "config" / "secrets.toml",
]


def _load_toml(paths: list[Path]) -> dict:
    for p in paths:
        if p.exists():
            with open(p, "rb") as f:
                return tomllib.load(f)
    return {}


@lru_cache(maxsize=1)
def load_config() -> dict:
    return _load_toml(CONFIG_PATHS)


@lru_cache(maxsize=1)
def get_secret() -> dict:
    return _load_toml(SECRETS_PATHS)


def get_network_config() -> dict:
    return load_config().get("network", {})
