# Sentinel Firewall — Dokumentation

Willkommen in der Sentinel Dokumentation.

## Inhaltsverzeichnis

| Dokument | Beschreibung |
|----------|-------------|
| [INSTALL.md](INSTALL.md) | Installationsanleitung + Fehlerbehebung |
| [NAT_GUIDE.md](NAT_GUIDE.md) | NAT, Masquerading, Port-Weiterleitung erklärt |

## Schnellstart

```bash
sudo bash installer.sh
```

Nach der Installation: `https://<LAN-Gateway-IP>`

## Architekturüberblick

```
sentinel/
├── installer.sh          # Ein-Befehl Installation
├── config/               # TOML-Konfiguration
├── backend/              # FastAPI REST API
│   ├── core/             # nftables, NAT, Scanner, DHCP, DNS, WG
│   ├── ids/              # Suricata, Anomaly, Response Engine
│   └── api/routes/       # HTTP Endpunkte
├── frontend/             # React 18 + Tailwind Dashboard
├── systemd/              # Service-Definitionen
└── docs/                 # Diese Dokumentation
```

## Wichtige API-Endpunkte

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| POST | `/api/system/auth/login` | Anmelden, JWT erhalten |
| GET | `/api/system/status` | CPU, RAM, Uptime |
| GET | `/api/nat/port-forwards` | Port-Weiterleitungen |
| POST | `/api/nat/port-forwards` | Regel hinzufügen |
| GET | `/api/threats/alerts` | Suricata-Alerts |
| POST | `/api/firewall/block/{ip}` | IP blockieren |
| GET | `/api/dhcp/leases` | Aktive DHCP-Clients |
| POST | `/api/vpn/peers` | WireGuard-Peer hinzufügen |
| WS | `/ws` | Live-Traffic + Alerts |

Alle Endpunkte (außer Login und Setup) benötigen einen `Authorization: Bearer <token>` Header.
