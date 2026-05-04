# Sentinel Firewall — CLAUDE.md

## Projekt
Name: Sentinel
Beschreibung: Self-hosted Open-Source Netzwerk-Firewall mit Web-Dashboard,
IDS/IPS, DHCP, DNS, WireGuard VPN, NAT/Masquerading und autonomer
Bedrohungsneutralisierung.
Stack: Python 3.12 (FastAPI) + React 18 (Vite + Tailwind CSS 3) + nftables +
ISC Kea DHCP + Unbound + Suricata + WireGuard
Plattform: Ubuntu 24.04 LTS, Bare-Metal / VM / LXC

## Development Commands
```bash
# Backend starten
cd sentinel && source .venv/bin/activate
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Frontend starten (dev)
cd sentinel/frontend && npm run dev

# nftables Regelwerk anzeigen
sudo nft list ruleset

# Service-Logs
sudo journalctl -u sentinel-api -f
sudo journalctl -u sentinel-ids -f

# Tests
cd sentinel && pytest backend/tests/
cd sentinel/frontend && npm run test
```

## Architektur
- Konfiguration: `/etc/sentinel/*.toml` (auf Produktionssystem) oder `sentinel/config/*.toml` (Entwicklung)
- Logs: `/var/log/sentinel/`
- Python venv: `/opt/sentinel/.venv` (Produktion)
- Frontend dist: `/opt/sentinel/www/` (Produktion, via nginx)
- Systemd services: `sentinel-api`, `sentinel-ids`, `sentinel-scanner.timer`

## Kritische Regeln
1. **nftables IMMER atomar**: `nft -f /tmp/sentinel_rules.nft` — niemals Einzelbefehle in einer Schleife
2. **Niemals iptables UND nftables gleichzeitig** — nur nftables
3. **Kein blocking I/O**: Alle Netzwerk- und Dateioperationen mit `asyncio`/`aiofiles`
4. **Keine hardcodierten IPs** — immer aus `config/sentinel.toml` lesen
5. **Secrets** in `config/secrets.toml` (chmod 600, nur root) — niemals in Git
6. **i18n**: Alle UI-Strings via `i18next` (de/en) — keine hardcodierten Strings in React-Komponenten
7. **JWT-Pflicht**: Alle API-Endpunkte außer `/api/system/auth/login` und `/api/system/setup/*` erfordern gültiges Bearer-Token
8. **Typen**: Python type hints überall, TypeScript strict mode im Frontend
9. **Atomare nftables-Konfig-Injection**: Marker-Kommentare in `/etc/nftables.conf` — nie die ganze Datei ersetzen
10. **Audit-Log**: Alle IDS-Auto-Response-Aktionen in `/var/log/sentinel/response.log`

## Wichtige externe Ports
| Port | Protokoll | Dienst |
|------|-----------|--------|
| 80/443 | TCP | nginx → Sentinel Dashboard |
| 8000 | TCP | FastAPI Backend (intern, via nginx-Proxy) |
| 8001 | TCP | Kea DHCP Control Agent (intern) |
| 51820 | UDP | WireGuard VPN |
| 53 | TCP/UDP | Unbound DNS |
| 67 | UDP | ISC Kea DHCP |

## nftables Marker-Kommentare
Diese Kommentare werden vom `NATManager` und `NftablesManager` genutzt um
Regeln dynamisch einzufügen. Niemals manuell entfernen:
```
# SENTINEL_INPUT_RULES_START / # SENTINEL_INPUT_RULES_END
# SENTINEL_FORWARD_RULES_START / # SENTINEL_FORWARD_RULES_END
# SENTINEL_DNAT_START / # SENTINEL_DNAT_END
# SENTINEL_MASQUERADE_START / # SENTINEL_MASQUERADE_END
```

## Verzeichnisstruktur
```
sentinel/
├── CLAUDE.md
├── README.md
├── installer.sh
├── config/                    # TOML-Konfiguration
│   ├── sentinel.toml
│   ├── subnets.toml
│   ├── nat.toml
│   ├── wireguard.toml
│   └── secrets.toml           # gitignored!
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── api/routes/            # FastAPI Router
│   ├── core/                  # nftables, NAT, Scanner, DHCP, DNS, WG
│   ├── ids/                   # Suricata, Anomaly, Response Engine
│   ├── notifications/         # Telegram, E-Mail
│   └── i18n/                  # Backend-Meldungen de/en
├── frontend/                  # React 18 + Vite + Tailwind
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── i18n/
│   │   └── store/
├── systemd/                   # systemd Unit-Dateien
└── docs/                      # Dokumentation
```
