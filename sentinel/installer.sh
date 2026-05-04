#!/usr/bin/env bash
# =============================================================================
# Sentinel Firewall Installer v1.0.0
# Ubuntu 24.04 LTS
# =============================================================================
set -euo pipefail

# --- Farben ---
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

SENTINEL_VERSION="1.0.0"
INSTALL_DIR="/opt/sentinel"
CONFIG_DIR="/etc/sentinel"
LOG_DIR="/var/log/sentinel"
DATA_DIR="/var/lib/sentinel"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# =============================================================================
# Hilfsfunktionen
# =============================================================================
info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }
die()     { error "$*"; exit 1; }

print_banner() {
    echo -e "${BLUE}${BOLD}"
    cat << 'BANNER'
  ====================================================
  |   ___         _   _          _                  |
  |  / __| ___ _ _| |_(_)_ _  __| |                 |
  |  \__ \/ -_) ' \  _| | ' \/ _` |                 |
  |  |___/\___|_||_\__|_|_||_\__,_|                 |
  |                                                  |
  |       Self-hosted Network Intelligence           |
  |                  v1.0.0                          |
  ====================================================
BANNER
    echo -e "${NC}"
}

# =============================================================================
# Schritt 1: Preflight-Checks
# =============================================================================
check_root() {
    [[ $EUID -eq 0 ]] || die "Root-Zugriff erforderlich. Bitte mit: sudo bash installer.sh"
    success "Root-Zugriff bestätigt"
}

check_ubuntu() {
    if [[ -f /etc/os-release ]]; then
        # shellcheck disable=SC1091
        . /etc/os-release
        if [[ "$ID" == "ubuntu" && "$VERSION_ID" == "24.04" ]]; then
            success "Ubuntu 24.04 LTS erkannt"
            return
        fi
    fi
    warn "Nicht Ubuntu 24.04 LTS erkannt — Fortfahren auf eigene Gefahr."
    read -rp "Trotzdem fortfahren? [j/N] " _ans
    [[ "$_ans" =~ ^[jJyY]$ ]] || die "Installation abgebrochen."
}

check_interfaces_count() {
    local count
    count=$(ip -o link show | grep -vc lo)
    if [[ $count -lt 2 ]]; then
        warn "Nur $count Netzwerk-Interface(s) erkannt. Für WAN+LAN werden mindestens 2 benötigt."
        read -rp "Trotzdem fortfahren? [j/N] " _ans
        [[ "$_ans" =~ ^[jJyY]$ ]] || die "Installation abgebrochen."
    fi
}

# =============================================================================
# Schritt 2: Interface-Auswahl
# =============================================================================
detect_interfaces() {
    info "Erkenne Netzwerk-Interfaces..."
    mapfile -t INTERFACES < <(ip -o link show | awk -F': ' '{print $2}' | grep -v lo)
    echo ""
    echo "  Gefundene Interfaces:"
    for i in "${!INTERFACES[@]}"; do
        local if_name="${INTERFACES[$i]}"
        local if_ip
        if_ip=$(ip -4 addr show "$if_name" 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1 || echo "keine IP")
        echo "  [$((i+1))] $if_name  ($if_ip)"
    done
    echo ""

    while true; do
        read -rp "  WAN-Interface (Internet) auswählen [1-${#INTERFACES[@]}]: " _wan_idx
        if [[ "$_wan_idx" =~ ^[0-9]+$ ]] && (( _wan_idx >= 1 && _wan_idx <= ${#INTERFACES[@]} )); then
            WAN_IF="${INTERFACES[$((_wan_idx-1))]}"
            break
        fi
        echo "  Ungültige Eingabe."
    done

    while true; do
        read -rp "  LAN-Interface (internes Netz) auswählen [1-${#INTERFACES[@]}]: " _lan_idx
        if [[ "$_lan_idx" =~ ^[0-9]+$ ]] && (( _lan_idx >= 1 && _lan_idx <= ${#INTERFACES[@]} )); then
            LAN_IF="${INTERFACES[$((_lan_idx-1))]}"
            if [[ "$LAN_IF" != "$WAN_IF" ]]; then
                break
            fi
            echo "  LAN muss sich vom WAN-Interface unterscheiden."
        else
            echo "  Ungültige Eingabe."
        fi
    done

    success "WAN: $WAN_IF | LAN: $LAN_IF"
}

# =============================================================================
# Schritt 3: IP-Konfiguration
# =============================================================================
collect_ip_config() {
    info "IP-Konfiguration..."

    WAN_IP=$(ip -4 addr show "$WAN_IF" 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1 || echo "")
    PUBLIC_IP=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || echo "$WAN_IP")
    echo "  WAN-IP:    ${BOLD}${WAN_IP:-unbekannt}${NC}"
    echo "  Public-IP: ${BOLD}${PUBLIC_IP:-unbekannt}${NC}"

    read -rp "  LAN-Subnetz [Standard: 192.168.1.0/24]: " _subnet
    LAN_SUBNET="${_subnet:-192.168.1.0/24}"

    # Gateway = erste nutzbare IP im Subnetz
    LAN_GW=$(echo "$LAN_SUBNET" | awk -F'[./]' '{print $1"."$2"."$3".1"}')
    DHCP_START=$(echo "$LAN_SUBNET" | awk -F'[./]' '{print $1"."$2"."$3".100"}')
    DHCP_END=$(echo "$LAN_SUBNET" | awk -F'[./]' '{print $1"."$2"."$3".200"}')

    echo "  Gateway:    ${BOLD}$LAN_GW${NC}"
    echo "  DHCP-Range: ${BOLD}$DHCP_START – $DHCP_END${NC}"

    # Admin-Passwort
    echo ""
    while true; do
        read -rsp "  Dashboard-Passwort festlegen: " _pw1; echo ""
        read -rsp "  Passwort bestätigen:          " _pw2; echo ""
        if [[ "$_pw1" == "$_pw2" && ${#_pw1} -ge 8 ]]; then
            DASHBOARD_PASSWORD="$_pw1"
            break
        elif [[ ${#_pw1} -lt 8 ]]; then
            echo "  Passwort muss mindestens 8 Zeichen lang sein."
        else
            echo "  Passwörter stimmen nicht überein."
        fi
    done

    success "IP-Konfiguration abgeschlossen"
}

# =============================================================================
# Schritt 4: Pakete installieren
# =============================================================================
install_packages() {
    info "Pakete installieren (das kann einige Minuten dauern)..."
    export DEBIAN_FRONTEND=noninteractive

    apt-get update -qq
    apt-get install -y -qq \
        python3.12 python3.12-venv python3-pip \
        nftables iproute2 \
        nmap \
        kea kea-dhcp4-server kea-ctrl-agent \
        unbound \
        wireguard wireguard-tools \
        suricata suricata-update \
        nginx \
        curl wget git \
        jq \
        openssl \
        qrencode \
        build-essential libssl-dev 2>/dev/null

    # Node.js 20 LTS falls nicht vorhanden
    if ! command -v node &>/dev/null || ! node --version | grep -q 'v20'; then
        info "Node.js 20 LTS installieren..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null
        apt-get install -y nodejs 2>/dev/null
    fi

    success "Pakete installiert"
}

# =============================================================================
# Schritt 5: Verzeichnisse anlegen
# =============================================================================
setup_directories() {
    info "Verzeichnisse anlegen..."
    mkdir -p "$INSTALL_DIR" "$CONFIG_DIR" "$LOG_DIR" "$DATA_DIR"
    mkdir -p "$DATA_DIR/wireguard" "$DATA_DIR/suricata" "$DATA_DIR/scans"
    mkdir -p "$CONFIG_DIR/ssl"
    chmod 750 "$CONFIG_DIR"
    success "Verzeichnisse erstellt"
}

# =============================================================================
# Schritt 6: nftables konfigurieren
# =============================================================================
setup_nftables() {
    info "nftables konfigurieren (NAT + Firewall)..."

    cat > /etc/nftables.conf << NFTEOF
#!/usr/sbin/nft -f
# Sentinel Firewall — nftables Hauptkonfiguration
# Generiert von installer.sh — Nicht manuell bearbeiten!
# Änderungen über das Sentinel Dashboard.

flush ruleset

table inet sentinel_firewall {

    set blocked_ips {
        type ipv4_addr
        flags dynamic, timeout
        timeout 1h
    }

    set rate_limited_ips {
        type ipv4_addr
        flags dynamic, timeout
        timeout 10m
    }

    set vpn_clients {
        type ipv4_addr
        flags dynamic
    }

    chain input {
        type filter hook input priority filter; policy drop;

        ct state established,related accept
        ct state invalid drop
        iif lo accept

        ip protocol icmp accept
        ip6 nexthdr icmpv6 accept

        ip saddr @blocked_ips drop

        # SSH (Rate-Limit)
        tcp dport 22 ct state new limit rate 3/minute burst 10 packets accept

        # Sentinel Dashboard + API
        tcp dport { 80, 443, 8000 } accept

        # DHCP
        udp dport 67 iif ${LAN_IF} accept

        # DNS
        tcp dport 53 iif ${LAN_IF} accept
        udp dport 53 iif ${LAN_IF} accept

        # WireGuard
        udp dport 51820 accept

        # LAN -> Firewall erlaubt
        iif ${LAN_IF} accept

        # SENTINEL_INPUT_RULES_START
        # SENTINEL_INPUT_RULES_END

        log prefix "SENTINEL-DROP: " flags all
    }

    chain forward {
        type filter hook forward priority filter; policy drop;

        ct state established,related accept
        ct state invalid drop

        ip saddr @blocked_ips drop
        ip daddr @blocked_ips drop

        # LAN -> WAN
        iif ${LAN_IF} oif ${WAN_IF} accept

        # WAN -> LAN (nur established)
        iif ${WAN_IF} oif ${LAN_IF} ct state established,related accept

        # VPN-Clients
        iif wg0 accept

        # SENTINEL_FORWARD_RULES_START
        # SENTINEL_FORWARD_RULES_END

        log prefix "SENTINEL-FWD-DROP: " flags all
    }

    chain output {
        type filter hook output priority filter; policy accept;
    }
}

table ip sentinel_nat {

    chain prerouting {
        type nat hook prerouting priority dstnat;

        # SENTINEL_DNAT_START
        # SENTINEL_DNAT_END
    }

    chain postrouting {
        type nat hook postrouting priority srcnat;

        # SENTINEL_MASQUERADE_START
        ip saddr ${LAN_SUBNET} oif ${WAN_IF} masquerade
        ip saddr 10.8.0.0/24 oif ${WAN_IF} masquerade
        # SENTINEL_MASQUERADE_END
    }
}
NFTEOF

    # IP-Forwarding aktivieren
    cat > /etc/sysctl.d/99-sentinel.conf << 'SYSCTL'
net.ipv4.ip_forward=1
net.ipv6.conf.all.forwarding=1
net.ipv4.conf.all.rp_filter=0
SYSCTL
    sysctl -p /etc/sysctl.d/99-sentinel.conf > /dev/null

    systemctl enable nftables
    nft -f /etc/nftables.conf

    success "nftables NAT + Firewall aktiv"
    info "  Masquerading: $LAN_SUBNET → Internet via $WAN_IF"
}

# =============================================================================
# Schritt 7: ISC Kea DHCP
# =============================================================================
setup_kea_dhcp() {
    info "ISC Kea DHCP konfigurieren..."

    cat > /etc/kea/kea-dhcp4.conf << KEAEOF
{
  "Dhcp4": {
    "interfaces-config": {
      "interfaces": ["${LAN_IF}"]
    },
    "lease-database": {
      "type": "memfile",
      "persist": true,
      "name": "/var/lib/kea/dhcp4.leases"
    },
    "valid-lifetime": 86400,
    "renew-timer": 43200,
    "rebind-timer": 75600,
    "subnet4": [
      {
        "id": 1,
        "subnet": "${LAN_SUBNET}",
        "pools": [{"pool": "${DHCP_START} - ${DHCP_END}"}],
        "option-data": [
          {"name": "routers", "data": "${LAN_GW}"},
          {"name": "domain-name-servers", "data": "${LAN_GW}"},
          {"name": "domain-name", "data": "sentinel.local"}
        ],
        "reservations": []
      }
    ],
    "control-socket": {
      "socket-type": "unix",
      "socket-name": "/run/kea/kea4-ctrl-socket"
    },
    "loggers": [{
      "name": "kea-dhcp4",
      "output_options": [{"output": "/var/log/sentinel/kea-dhcp4.log"}],
      "severity": "WARN"
    }]
  }
}
KEAEOF

    # Kea Control Agent auf Port 8001 (nicht 8000 wegen Konflikt mit Sentinel API)
    cat > /etc/kea/kea-ctrl-agent.conf << 'CTLAGENTEOF'
{
  "Control-agent": {
    "http-host": "127.0.0.1",
    "http-port": 8001,
    "control-sockets": {
      "dhcp4": {
        "socket-type": "unix",
        "socket-name": "/run/kea/kea4-ctrl-socket"
      }
    },
    "loggers": [{
      "name": "kea-ctrl-agent",
      "output_options": [{"output": "stdout"}],
      "severity": "WARN"
    }]
  }
}
CTLAGENTEOF

    systemctl enable kea-dhcp4-server kea-ctrl-agent
    systemctl restart kea-dhcp4-server kea-ctrl-agent
    success "DHCP aktiv: $DHCP_START – $DHCP_END"
}

# =============================================================================
# Schritt 8: Unbound DNS
# =============================================================================
setup_unbound() {
    info "Unbound DNS konfigurieren..."

    cat > /etc/unbound/unbound.conf.d/sentinel.conf << UCONF
server:
    interface: ${LAN_GW}
    interface: 127.0.0.1
    port: 53
    access-control: ${LAN_SUBNET} allow
    access-control: 127.0.0.0/8 allow
    access-control: 10.8.0.0/24 allow
    do-ip4: yes
    do-udp: yes
    do-tcp: yes
    hide-identity: yes
    hide-version: yes
    harden-glue: yes
    harden-dnssec-stripped: yes
    use-caps-for-id: yes
    private-address: 192.168.0.0/16
    private-address: 10.0.0.0/8
    private-address: 172.16.0.0/12
    logfile: "/var/log/sentinel/unbound.log"
    verbosity: 1

forward-zone:
    name: "."
    forward-addr: 9.9.9.9@853#dns.quad9.net
    forward-tls-upstream: yes
UCONF

    systemctl enable unbound
    systemctl restart unbound
    success "DNS/Unbound auf $LAN_GW:53 aktiv"
}

# =============================================================================
# Schritt 9: WireGuard VPN
# =============================================================================
setup_wireguard() {
    info "WireGuard VPN konfigurieren..."

    mkdir -p /etc/wireguard
    chmod 700 /etc/wireguard

    wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key
    chmod 600 /etc/wireguard/server_private.key
    SERVER_PRIVATE=$(cat /etc/wireguard/server_private.key)
    SERVER_PUBLIC=$(cat /etc/wireguard/server_public.key)

    cat > /etc/wireguard/wg0.conf << WGEOF
[Interface]
Address = 10.8.0.1/24
ListenPort = 51820
PrivateKey = ${SERVER_PRIVATE}

# SENTINEL-PEERS-START
# SENTINEL-PEERS-END
WGEOF
    chmod 600 /etc/wireguard/wg0.conf

    systemctl enable wg-quick@wg0
    systemctl start wg-quick@wg0
    success "WireGuard VPN aktiv (Port 51820/UDP, Server-IP: 10.8.0.1)"
    info "  Server Public Key: $SERVER_PUBLIC"
}

# =============================================================================
# Schritt 10: Suricata IDS
# =============================================================================
setup_suricata() {
    info "Suricata IDS/IPS konfigurieren..."

    mkdir -p "$LOG_DIR/suricata"

    # Suricata Update (Regel-Download)
    suricata-update update-sources --no-merge 2>/dev/null || true
    suricata-update 2>/dev/null || true

    # Suricata für WAN-Interface konfigurieren
    cat >> /etc/suricata/suricata.yaml << SUREOF

# Sentinel-Erweiterung
af-packet:
  - interface: ${WAN_IF}
    threads: auto
    cluster-id: 99
    cluster-type: cluster_flow
    defrag: yes
SUREOF

    systemctl enable suricata
    systemctl restart suricata
    success "Suricata IDS aktiv (EVE-Log: /var/log/suricata/eve.json)"
}

# =============================================================================
# Schritt 11: Python Backend
# =============================================================================
install_python_backend() {
    info "Python Backend installieren..."

    # Quellcode kopieren
    cp -r "$SRC_DIR/backend" "$INSTALL_DIR/"
    cp -r "$SRC_DIR/config" "$INSTALL_DIR/"

    cd "$INSTALL_DIR"
    python3.12 -m venv .venv
    # shellcheck disable=SC1091
    source .venv/bin/activate
    pip install -q --upgrade pip
    pip install -q -r backend/requirements.txt

    success "Python Backend installiert"
}

# =============================================================================
# Schritt 12: Frontend bauen
# =============================================================================
build_frontend() {
    info "Frontend bauen..."

    cp -r "$SRC_DIR/frontend" "$INSTALL_DIR/"
    cd "$INSTALL_DIR/frontend"
    npm ci --silent
    npm run build --silent

    success "Frontend gebaut: $INSTALL_DIR/frontend/dist"
}

# =============================================================================
# Schritt 13: nginx konfigurieren
# =============================================================================
setup_nginx() {
    info "nginx konfigurieren..."

    # Self-signed SSL
    openssl req -x509 -newkey rsa:4096 -nodes \
        -keyout "$CONFIG_DIR/ssl/key.pem" \
        -out "$CONFIG_DIR/ssl/cert.pem" \
        -days 3650 -subj "/CN=sentinel.local/O=Sentinel/C=DE" 2>/dev/null

    cat > /etc/nginx/sites-available/sentinel << NGINXEOF
server {
    listen 80;
    server_name _;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name _;

    ssl_certificate     $CONFIG_DIR/ssl/cert.pem;
    ssl_certificate_key $CONFIG_DIR/ssl/key.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    root $INSTALL_DIR/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /ws {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }
}
NGINXEOF

    ln -sf /etc/nginx/sites-available/sentinel /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    nginx -t
    systemctl enable nginx
    systemctl restart nginx
    success "nginx konfiguriert (HTTPS auf Port 443)"
}

# =============================================================================
# Schritt 14: Konfiguration schreiben
# =============================================================================
write_config() {
    info "Konfiguration schreiben..."

    # bcrypt Hash des Passworts
    DASHBOARD_HASH=$(
        "$INSTALL_DIR/.venv/bin/python3" -c \
        "from passlib.hash import bcrypt; print(bcrypt.hash('$DASHBOARD_PASSWORD', rounds=12))"
    )
    JWT_SECRET=$(openssl rand -hex 32)
    SERVER_PUBLIC=$(cat /etc/wireguard/server_public.key 2>/dev/null || echo "")

    cat > "$CONFIG_DIR/sentinel.toml" << CFGEOF
version = "$SENTINEL_VERSION"

[general]
hostname = "sentinel"
timezone = "Europe/Berlin"
language = "de"

[network]
wan_interface = "$WAN_IF"
lan_interface = "$LAN_IF"
lan_subnet = "$LAN_SUBNET"
lan_gateway = "$LAN_GW"
public_ip = "$PUBLIC_IP"

[api]
host = "127.0.0.1"
port = 8000
jwt_expiry_minutes = 480

[ids]
enabled = true
auto_block = false
confidence_threshold = 80
eve_log = "/var/log/suricata/eve.json"

[scanner]
enabled = true
schedule_hour = 3
nmap_timing = "T4"

[notifications]
telegram_enabled = false
email_enabled = false

[dhcp]
enabled = true
lease_time = 86400

[dns]
enabled = true
upstream = "9.9.9.9"

[vpn]
enabled = true
subnet = "10.8.0.0/24"
port = 51820
public_key = "$SERVER_PUBLIC"
CFGEOF

    cat > "$CONFIG_DIR/secrets.toml" << SECEOF
[api]
jwt_secret = "$JWT_SECRET"
admin_password_hash = "$DASHBOARD_HASH"

[notifications]
telegram_bot_token = ""
telegram_chat_id = ""
smtp_host = ""
smtp_port = 587
smtp_user = ""
smtp_password = ""
smtp_from = ""
smtp_to = ""
SECEOF
    chmod 600 "$CONFIG_DIR/secrets.toml"
    success "Konfiguration gespeichert in $CONFIG_DIR"
}

# =============================================================================
# Schritt 15: systemd Services einrichten
# =============================================================================
setup_systemd() {
    info "systemd Services einrichten..."

    cp -f "$SRC_DIR/systemd/"*.service /etc/systemd/system/ 2>/dev/null || true
    cp -f "$SRC_DIR/systemd/"*.timer /etc/systemd/system/ 2>/dev/null || true

    # INSTALL_DIR in Service-Dateien ersetzen
    for f in /etc/systemd/system/sentinel-*.service /etc/systemd/system/sentinel-*.timer; do
        [[ -f "$f" ]] && sed -i "s|/opt/sentinel|$INSTALL_DIR|g" "$f"
    done

    systemctl daemon-reload
    systemctl enable sentinel-api.service sentinel-ids.service sentinel-scanner.timer
    systemctl start sentinel-api.service
    systemctl start sentinel-ids.service || true  # Startet erst wenn Suricata EVE-Log existiert
    systemctl start sentinel-scanner.timer

    # Log-Rotation
    cat > /etc/logrotate.d/sentinel << 'LOGROTATEOF'
/var/log/sentinel/*.log {
    weekly
    rotate 4
    compress
    missingok
    notifempty
    postrotate
        systemctl reload sentinel-api 2>/dev/null || true
    endscript
}
LOGROTATEEOF

    success "systemd Services aktiv"
}

# =============================================================================
# Abschluss-Meldung
# =============================================================================
print_success() {
    echo ""
    echo -e "${GREEN}${BOLD}============================================================${NC}"
    echo -e "${GREEN}${BOLD}   SENTINEL ERFOLGREICH INSTALLIERT!${NC}"
    echo -e "${GREEN}${BOLD}============================================================${NC}"
    echo ""
    echo -e "  ${BOLD}Dashboard:${NC}  https://$LAN_GW"
    echo -e "  ${BOLD}Passwort:${NC}   [während Installation gesetzt]"
    echo ""
    echo -e "  ${CYAN}Netzwerk:${NC}"
    echo -e "    WAN: $WAN_IF (${PUBLIC_IP:-unbekannt})"
    echo -e "    LAN: $LAN_IF ($LAN_GW)"
    echo -e "    DHCP: $DHCP_START – $DHCP_END"
    echo -e "    NAT: $LAN_SUBNET → Internet ✓"
    echo ""
    echo -e "  ${CYAN}Services:${NC}"
    echo -e "    sentinel-api.service    $(systemctl is-active sentinel-api 2>/dev/null)"
    echo -e "    sentinel-ids.service    $(systemctl is-active sentinel-ids 2>/dev/null)"
    echo -e "    sentinel-scanner.timer  $(systemctl is-active sentinel-scanner.timer 2>/dev/null)"
    echo -e "    kea-dhcp4-server        $(systemctl is-active kea-dhcp4-server 2>/dev/null)"
    echo -e "    unbound                 $(systemctl is-active unbound 2>/dev/null)"
    echo -e "    suricata                $(systemctl is-active suricata 2>/dev/null)"
    echo ""
    echo -e "  ${YELLOW}Logs:${NC} journalctl -u sentinel-api -f"
    echo ""
}

# =============================================================================
# MAIN
# =============================================================================
main() {
    print_banner
    check_root
    check_ubuntu
    check_interfaces_count
    detect_interfaces
    collect_ip_config
    install_packages
    setup_directories
    setup_nftables
    setup_kea_dhcp
    setup_unbound
    setup_wireguard
    setup_suricata
    install_python_backend
    build_frontend
    setup_nginx
    write_config
    setup_systemd
    print_success
}

main "$@"
