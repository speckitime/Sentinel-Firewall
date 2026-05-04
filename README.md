# Sentinel Firewall

> Self-hosted open-source network firewall with web dashboard, IDS/IPS, DHCP, DNS, WireGuard VPN, and autonomous threat response.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Ubuntu%2024.04-orange.svg)
![Python](https://img.shields.io/badge/python-3.12-blue.svg)

## Features

- **Firewall** — nftables-based stateful packet filtering with dynamic rule management
- **NAT/Masquerading** — Instant internet access for all LAN clients; port-forwarding UI
- **DHCP** — ISC Kea server with lease management dashboard
- **DNS** — Unbound recursive resolver with custom record support
- **VPN** — WireGuard with QR-code peer provisioning
- **IDS/IPS** — Suricata integration with ML anomaly detection and auto-block
- **Dashboard** — Real-time traffic graphs, threat timeline, system health
- **i18n** — German and English UI

## Quick Start

```bash
git clone https://github.com/speckitime/sentinel-firewall.git
cd sentinel-firewall
sudo bash installer.sh
```

The installer will:
1. Detect your network interfaces
2. Configure nftables, Kea DHCP, Unbound DNS, WireGuard, and Suricata
3. Build and deploy the web dashboard
4. Print the dashboard URL (e.g. `https://10.0.1.1`)

## Requirements

- Ubuntu 24.04 LTS (fresh install recommended)
- Two network interfaces (WAN + LAN)
- Root access
- Internet connection during setup

## Documentation

- [Installation Guide](docs/INSTALL.md)
- [NAT & Port Forwarding](docs/NAT_GUIDE.md)

## Architecture

```
 Internet ←→ [WAN Interface]
                    |
              [nftables NAT]
                    |
              [LAN Interface] ←→ DHCP clients
                    |
         [Sentinel API :8000]
         [Web Dashboard :443]
```

## License

MIT — see [LICENSE](LICENSE)
