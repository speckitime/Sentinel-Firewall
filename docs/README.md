# Sentinel Firewall — Documentation

Welcome to the Sentinel Firewall documentation.

## Contents

- [Installation Guide](INSTALL.md)
- [NAT & Port Forwarding Guide](NAT_GUIDE.md)

## Architecture Overview

Sentinel consists of the following components:

| Component | Technology | Purpose |
|-----------|-----------|----------|
| Firewall  | nftables  | Stateful packet filtering, sets |
| NAT       | nftables  | Masquerading + DNAT port forwards |
| DHCP      | ISC Kea   | IP address assignment |
| DNS       | Unbound   | Recursive resolver, local records |
| VPN       | WireGuard | Peer-to-site encrypted tunnels |
| IDS       | Suricata  | Signature + anomaly detection |
| API       | FastAPI   | REST + WebSocket backend |
| Dashboard | React 18  | Web UI (DE/EN) |

## Default Ports

| Port | Service |
|------|--------|
| 443  | Web Dashboard (HTTPS) |
| 8000 | Sentinel API (internal only) |
| 8001 | Kea Control Agent (127.0.0.1 only) |
| 51820| WireGuard VPN |
| 53   | DNS (LAN only) |
| 67   | DHCP |
