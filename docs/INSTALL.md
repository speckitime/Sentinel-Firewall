# Installation Guide

## Requirements

- Ubuntu 24.04 LTS (fresh install recommended)
- Two network interfaces: one for WAN (internet), one for LAN
- Root / sudo access
- Internet connection during setup

## Automated Installation

```bash
git clone https://github.com/speckitime/sentinel-firewall.git
cd sentinel-firewall
sudo bash installer.sh
```

The installer will prompt you for:
1. **WAN interface** — the interface connected to your router/modem
2. **LAN interface** — the interface connected to your local network switch
3. **LAN subnet** — e.g. `10.0.1.0/24` (default)
4. **Admin password** — for the web dashboard

## What Gets Installed

| Package | Purpose |
|---------|--------|
| nftables | Firewall + NAT |
| kea-dhcp4-server | DHCP server |
| kea-ctrl-agent | Kea HTTP control API (port 8001) |
| unbound | DNS resolver |
| wireguard-tools | VPN |
| suricata | IDS/IPS |
| nginx | Reverse proxy + TLS termination |
| python3.12 | Backend runtime |
| nodejs / npm | Frontend build |

## Post-Install

After installation, navigate to `https://<LAN_GATEWAY>` (e.g. `https://10.0.1.1`).  
Accept the self-signed certificate warning and log in with username `admin` and the password you set.

## Service Management

```bash
# API service
systemctl status sentinel-api
journalctl -u sentinel-api -f

# IDS monitor
systemctl status sentinel-ids

# Manual port scan
systemctl start sentinel-scanner
```

## Uninstallation

```bash
systemctl disable --now sentinel-api sentinel-ids sentinel-scanner.timer
apt-get remove --purge nftables kea-dhcp4-server unbound suricata wireguard-tools
rm -rf /opt/sentinel /etc/sentinel
```
