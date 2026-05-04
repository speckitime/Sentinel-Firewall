# Sentinel Firewall — Agent Guidance

## Project Purpose
Sentinel is a self-hosted open-source network firewall with web dashboard, IDS/IPS, DHCP, DNS, WireGuard VPN, NAT/masquerading, and autonomous threat response. Target: home-lab users and small businesses running Ubuntu 24.04 LTS.

## Tech Stack
- **Backend**: Python 3.12, FastAPI, asyncio, aiofiles, python-jose (JWT), passlib (bcrypt), tomllib/tomli-w
- **Frontend**: React 18, Vite, Tailwind CSS 3, Zustand, TanStack Query, i18next (de/en)
- **Firewall**: nftables (NOT iptables)
- **DHCP**: ISC Kea (kea-dhcp4-server) — control agent on port 8001
- **DNS**: Unbound
- **VPN**: WireGuard (wg-quick@wg0)
- **IDS/IPS**: Suricata (EVE JSON log)
- **Systemd**: Type=notify via sdnotify

## Directory Layout
```
/
├── backend/         # FastAPI app
│   ├── main.py
│   ├── requirements.txt
│   ├── api/
│   │   ├── routes/  # firewall, nat, dhcp, dns, vpn, threats, scanner, system
│   │   └── websocket.py
│   ├── core/        # nftables, nat_manager, port_scanner, dhcp_manager, dns_manager, wireguard, config, auth
│   ├── ids/         # suricata, anomaly, response
│   ├── i18n/        # en.py, de.py
│   └── notifications/ # telegram.py, email.py
├── frontend/        # React app
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── store/
│   │   ├── i18n/
│   │   └── lib/
├── config/          # TOML configuration (secrets.toml gitignored)
├── systemd/         # systemd service + timer files
├── docs/            # Documentation
└── installer.sh     # Automated setup script
```

## Dev Commands
```bash
# Backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Frontend
cd frontend && npm install && npm run dev

# Run full build
cd frontend && npm run build
```

## Critical Rules
1. **nftables only** — never mix iptables + nftables
2. **Atomic nftables changes** — always via `nft -f /tmp/sentinel_rules.nft` (write to temp, apply, delete)
3. **All async** — asyncio/aiofiles throughout; no blocking I/O on the event loop
4. **Config in TOML** — `config/*.toml`, never hardcoded IPs or secrets
5. **Secrets protection** — `config/secrets.toml` is chmod 600 and gitignored
6. **All UI strings via i18next** — `de.json` and `en.json`; no hardcoded user-visible text
7. **JWT on all API routes** except `/api/system/auth/login` and `/api/system/setup/*`
8. **Kea on port 8001** — control agent must not use 8000 (conflicts with Sentinel API)
9. **sdnotify** — call `sd_notify(READY=1)` in FastAPI lifespan for Type=notify systemd
10. **Marker comments** — nftables conf uses `# SENTINEL_*_START/END` markers for dynamic injection

## nftables Marker System
```
# SENTINEL_INPUT_RULES_START
# SENTINEL_INPUT_RULES_END
# SENTINEL_FORWARD_RULES_START
# SENTINEL_FORWARD_RULES_END
# SENTINEL_DNAT_START
# SENTINEL_DNAT_END
# SENTINEL_MASQUERADE_START
# SENTINEL_MASQUERADE_END
```

## Config Fallback Paths
Backend checks `/etc/sentinel/*.toml` first, falls back to `config/*.toml` for local dev.

## Architecture Notes
- WebSocket `/ws` streams real-time traffic stats (bytes/sec per interface)
- IDS response engine: 0-40=log, 40-60=alert, 60-80=rate-limit, 80-100=block (if auto_block=true)
- All blocked IPs use nftables set timeout (1h auto-unblock)
- WireGuard peers get QR codes via `qrencode` subprocess
- DHCP lease list fed to NAT port-forward form (internal IP dropdown)
