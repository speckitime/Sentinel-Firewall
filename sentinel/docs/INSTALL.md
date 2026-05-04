# Sentinel Firewall — Installationsanleitung

## Voraussetzungen

| Anforderung | Minimum | Empfohlen |
|-------------|---------|----------|
| Betriebssystem | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |
| CPU | 1 vCPU | 2+ vCPU |
| RAM | 1 GB | 2+ GB |
| Disk | 8 GB | 20+ GB |
| Netzwerk-Interfaces | 2 (WAN + LAN) | 2+ |
| Zugriff | Root / sudo | Root |

## Schnellinstallation

```bash
# Option 1: Direkt von GitHub
curl -sSL https://raw.githubusercontent.com/speckitime/sentinel-firewall/main/sentinel/installer.sh | sudo bash

# Option 2: Repository klonen
git clone https://github.com/speckitime/sentinel-firewall.git
cd sentinel-firewall/sentinel
sudo bash installer.sh
```

Der Installer führt dich interaktiv durch:
1. WAN-Interface auswählen (Internet-Anbindung)
2. LAN-Interface auswählen (internes Netz)
3. LAN-Subnetz konfigurieren
4. Dashboard-Passwort setzen
5. Automatische Installation aller Abhängigkeiten und Services

Nach Abschluss: `https://<LAN-Gateway-IP>` im Browser öffnen.

## Was wird installiert?

| Komponente | Paket / Dienst | Zweck |
|-----------|---------------|-------|
| Firewall | nftables | Paketfilterung, NAT, Masquerading |
| DHCP | ISC Kea | IP-Adressen für LAN-Geräte |
| DNS | Unbound | Rekursiver DNS-Resolver mit DoT |
| VPN | WireGuard | Sicherer Remote-Zugang |
| IDS/IPS | Suricata | Intrusion Detection & Prevention |
| Backend | Python 3.12 + FastAPI | REST API + WebSocket |
| Frontend | React 18 + Nginx | Web-Dashboard (HTTPS) |

## Netzwerk-Topologie nach Installation

```
         Internet
            |
       [ WAN-Interface ]
            |
    [ Sentinel Firewall ]
    nftables + Suricata
            |
       [ LAN-Interface ]
            |
     +------+------+
     |      |      |
  PC-1   PC-2   NAS
  DHCP  DHCP   DHCP
```

Alle LAN-Geräte erhalten automatisch Internet-Zugang via NAT/Masquerading.

## Post-Installation

### 1. Dashboard öffnen
```
https://192.168.1.1  (oder deine konfigurierte LAN-Gateway-IP)
```
Zertifikatswarnung im Browser bestätigen (self-signed SSL).

### 2. Port-Scan ausführen
Dashboard → "Ports" → "Scan starten"

Dies zeigt alle offenen Ports und empfiehlt Firewall-Regeln.

### 3. Benachrichtigungen einrichten (optional)
Einstellungen → Benachrichtigungen → Telegram-Token + Chat-ID eintragen.

## Service-Management

```bash
# Status aller Sentinel-Services
systemctl status sentinel-api sentinel-ids suricata kea-dhcp4-server unbound

# Logs in Echtzeit
journalctl -u sentinel-api -f
journalctl -u sentinel-ids -f

# Services neu starten
systemctl restart sentinel-api
systemctl restart kea-dhcp4-server
systemctl restart unbound

# nftables Regelwerk anzeigen
nft list ruleset

# Aktive DHCP-Leases
cat /var/lib/kea/dhcp4.leases
```

## Fehlerbehebung

### Problem: Dashboard nicht erreichbar
```bash
# nginx Status prüfen
systemctl status nginx
nginx -t

# API Status prüfen
curl http://127.0.0.1:8000/health
```

### Problem: Kein Internet im LAN
```bash
# IP-Forwarding prüfen
cat /proc/sys/net/ipv4/ip_forward  # Muss "1" sein

# nftables NAT prüfen
nft list table ip sentinel_nat

# Masquerade-Regel vorhanden?
nft list chain ip sentinel_nat postrouting
```

### Problem: DHCP vergibt keine IPs
```bash
systemctl status kea-dhcp4-server
journalctl -u kea-dhcp4-server -n 50

# Konfiguration prüfen
cat /etc/kea/kea-dhcp4.conf | python3 -m json.tool
```

### Problem: API startet nicht
```bash
journalctl -u sentinel-api -n 100

# Python venv prüfen
/opt/sentinel/.venv/bin/python -c "import fastapi; print('OK')"

# Manuell starten (für Debug-Output)
cd /opt/sentinel && .venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

## Log-Dateien

| Log | Pfad |
|-----|------|
| Sentinel API | `journalctl -u sentinel-api` |
| IDS Monitor | `journalctl -u sentinel-ids` |
| Auto-Response | `/var/log/sentinel/response.log` |
| Suricata Alerts | `/var/log/suricata/eve.json` |
| Unbound DNS | `/var/log/sentinel/unbound.log` |
| Kea DHCP | `/var/log/sentinel/kea-dhcp4.log` |

## Deinstallation

```bash
# Services stoppen
systemctl stop sentinel-api sentinel-ids sentinel-scanner.timer
systemctl stop kea-dhcp4-server unbound wg-quick@wg0 suricata

# Services deaktivieren
systemctl disable sentinel-api sentinel-ids sentinel-scanner.timer

# Dateien entfernen (VORSICHT: Konfiguration wird gelöscht!)
rm -rf /opt/sentinel /etc/sentinel /var/log/sentinel /var/lib/sentinel
rm -f /etc/systemd/system/sentinel-*.service /etc/systemd/system/sentinel-*.timer
systemctl daemon-reload
```
