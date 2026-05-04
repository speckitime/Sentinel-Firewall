#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Sentinel Firewall — Automated Installer
# Ubuntu 24.04 LTS | nftables + Kea + Unbound + WireGuard + Suricata
# =============================================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
BOLD='\033[1m'; RESET='\033[0m'

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/opt/sentinel"
CONF_DIR="/etc/sentinel"

info()  { echo -e "${CYAN}[INFO]${RESET}  $*"; }
ok()    { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error() { echo -e "${RED}[ERROR]${RESET} $*"; exit 1; }

# =============================================================================
# 1. PREFLIGHT
# =============================================================================
info "Sentinel Firewall Installer"
echo
[[ "$EUID" -ne 0 ]] && error "Must run as root (sudo bash installer.sh)"

if ! grep -q 'Ubuntu 24.04' /etc/os-release 2>/dev/null; then
  warn "Not Ubuntu 24.04 LTS — continuing anyway, but untested."
fi

# =============================================================================
# 2. INTERFACE DETECTION
# =============================================================================
info "Detecting network interfaces..."
mapfile -t IFACES < <(ip -o link show | awk -F': ' '{print $2}' | grep -v '^lo$')

echo "Available interfaces:"
for i in "${!IFACES[@]}"; do
  echo "  [$i] ${IFACES[$i]}"
done

read -rp "Select WAN interface [0-$((${#IFACES[@]}-1))]: " WAN_IDX
read -rp "Select LAN interface [0-$((${#IFACES[@]}-1))]: " LAN_IDX
WAN_IF="${IFACES[$WAN_IDX]}"
LAN_IF="${IFACES[$LAN_IDX]}"
[[ "$WAN_IF" == "$LAN_IF" ]] && error "WAN and LAN must be different interfaces"
ok "WAN=$WAN_IF  LAN=$LAN_IF"

# =============================================================================
# 3. IP CONFIGURATION
# =============================================================================
PUBLIC_IP=$(ip -4 addr show "$WAN_IF" | grep -oP '(?<=inet )\d+\.\d+\.\d+\.\d+' | head -1 || true)
[[ -z "$PUBLIC_IP" ]] && PUBLIC_IP="(dynamic)"

read -rp "LAN subnet [default: 10.0.1.0/24]: " LAN_SUBNET
LAN_SUBNET="${LAN_SUBNET:-10.0.1.0/24}"

# Derive gateway (first usable host)
IFS='/' read -r NET_ADDR CIDR <<< "$LAN_SUBNET"
IFS='.' read -r a b c d <<< "$NET_ADDR"
LAN_GW="${a}.${b}.${c}.$((d+1))"
DHCP_START="${a}.${b}.${c}.$((d+100))"
DHCP_END="${a}.${b}.${c}.$((d+200))"

read -rsp "Admin password: " ADMIN_PASS; echo
read -rsp "Confirm password: " ADMIN_PASS2; echo
[[ "$ADMIN_PASS" != "$ADMIN_PASS2" ]] && error "Passwords do not match"

ok "LAN gateway: $LAN_GW  |  DHCP: $DHCP_START-$DHCP_END"

# =============================================================================
# 4. PACKAGE INSTALLATION
# =============================================================================
info "Installing packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  python3.12 python3.12-venv python3-pip \
  nftables \
  suricata suricata-update \
  kea-dhcp4-server kea-ctrl-agent \
  unbound \
  wireguard-tools qrencode \
  nmap \
  nodejs npm \
  nginx openssl \
  net-tools curl jq
ok "Packages installed"

# =============================================================================
# 4b. CONFIGURE LAN INTERFACE IP
# =============================================================================
info "Configuring LAN interface $LAN_IF with gateway IP $LAN_GW/$CIDR..."

ip addr flush dev "$LAN_IF" 2>/dev/null || true
ip addr add "${LAN_GW}/${CIDR}" dev "$LAN_IF"
ip link set "$LAN_IF" up

mkdir -p /etc/netplan
cat > /etc/netplan/99-sentinel-lan.yaml << NETEOF
network:
  version: 2
  ethernets:
    ${LAN_IF}:
      dhcp4: false
      addresses:
        - ${LAN_GW}/${CIDR}
NETEOF
chmod 600 /etc/netplan/99-sentinel-lan.yaml
netplan apply 2>/dev/null || warn "netplan apply failed — IP set via ip command only"
ok "LAN interface configured: $LAN_IF = $LAN_GW/$CIDR"

# =============================================================================
# 5. NFTABLES
# =============================================================================
info "Configuring nftables..."

sed -i 's/#net.ipv4.ip_forward=1/net.ipv4.ip_forward=1/' /etc/sysctl.conf
sysctl -w net.ipv4.ip_forward=1 > /dev/null

if [[ -f /etc/nftables.conf ]] && ! grep -q 'sentinel_firewall' /etc/nftables.conf 2>/dev/null; then
  BACKUP="/etc/nftables.conf.pre-sentinel.$(date +%Y%m%d%H%M%S)"
  cp /etc/nftables.conf "$BACKUP"
  warn "Existing nftables.conf backed up to $BACKUP"
fi

cat > /etc/nftables.conf << NFTEOF
#!/usr/sbin/nft -f

flush ruleset

table inet sentinel_firewall {
  set blocked_ips {
    type ipv4_addr
    flags dynamic,timeout
    timeout 1h
  }

  set rate_limited_ips {
    type ipv4_addr
    flags dynamic,timeout
    timeout 10m
  }

  set vpn_clients {
    type ipv4_addr
    flags dynamic
  }

  chain input {
    type filter hook input priority 0; policy drop;
    ct state invalid drop
    ct state {established, related} accept
    iif lo accept
    ip saddr @blocked_ips drop
    iifname "${LAN_IF}" accept
    iifname "wg0" accept
    tcp dport 22 accept
    tcp dport {80, 443} accept
    icmp type echo-request accept
    # SENTINEL_INPUT_RULES_START
    # SENTINEL_INPUT_RULES_END
  }

  chain forward {
    type filter hook forward priority 0; policy drop;
    ct state {established, related} accept
    ip saddr @blocked_ips drop
    iifname "${LAN_IF}" oifname "${WAN_IF}" accept
    iifname "wg0" oifname "${WAN_IF}" accept
    iifname "${WAN_IF}" ct state {established, related} accept
    # SENTINEL_FORWARD_RULES_START
    # SENTINEL_FORWARD_RULES_END
  }

  chain output {
    type filter hook output priority 0; policy accept;
  }
}

table ip sentinel_nat {
  chain prerouting {
    type nat hook prerouting priority -100;
    # SENTINEL_DNAT_START
    # SENTINEL_DNAT_END
  }

  chain postrouting {
    type nat hook postrouting priority 100;
    # SENTINEL_MASQUERADE_START
    ip saddr ${LAN_SUBNET} oifname "${WAN_IF}" masquerade
    # SENTINEL_MASQUERADE_END
  }
}
NFTEOF

systemctl enable nftables
nft -f /etc/nftables.conf
ok "nftables configured"

# =============================================================================
# 6. KEA DHCP
# =============================================================================
info "Configuring Kea DHCP..."

mkdir -p /etc/kea
cat > /etc/kea/kea-dhcp4.conf << KEAEOF
{
  "Dhcp4": {
    "interfaces-config": {
      "interfaces": ["${LAN_IF}"]
    },
    "control-socket": {
      "socket-type": "unix",
      "socket-name": "/run/kea/kea4-ctrl-socket"
    },
    "lease-database": {
      "type": "memfile",
      "persist": true,
      "name": "/var/lib/kea/kea-leases4.csv"
    },
    "subnet4": [{
      "subnet": "${LAN_SUBNET}",
      "pools": [{"pool": "${DHCP_START} - ${DHCP_END}"}],
      "option-data": [
        {"name": "routers", "data": "${LAN_GW}"},
        {"name": "domain-name-servers", "data": "${LAN_GW}"},
        {"name": "domain-name", "data": "sentinel.local"}
      ]
    }],
    "loggers": [{
      "name": "kea-dhcp4",
      "output_options": [{"output": "/var/log/kea/kea-dhcp4.log"}],
      "severity": "WARN"
    }]
  }
}
KEAEOF

cat > /etc/kea/kea-ctrl-agent.conf << CTRLEOF
{
  "Control-agent": {
    "http-host": "127.0.0.1",
    "http-port": 8001,
    "control-sockets": {
      "dhcp4": {
        "socket-type": "unix",
        "socket-name": "/run/kea/kea4-ctrl-socket"
      }
    }
  }
}
CTRLEOF

mkdir -p /var/lib/kea /var/log/kea /run/kea
systemctl enable kea-dhcp4-server kea-ctrl-agent
systemctl restart kea-dhcp4-server kea-ctrl-agent
ok "Kea DHCP configured (control agent on port 8001)"

# =============================================================================
# 7. UNBOUND DNS
# =============================================================================
info "Configuring Unbound DNS..."

# Disable systemd-resolved stub listener so it doesn't hold port 53
if systemctl is-active --quiet systemd-resolved; then
  mkdir -p /etc/systemd/resolved.conf.d
  cat > /etc/systemd/resolved.conf.d/no-stub.conf << RESEOF
[Resolve]
DNSStubListener=no
RESEOF
  systemctl restart systemd-resolved
  # Remove the stub symlink so /etc/resolv.conf points to a real nameserver
  rm -f /etc/resolv.conf
  echo "nameserver 1.1.1.1" > /etc/resolv.conf
fi

mkdir -p /etc/unbound/unbound.conf.d
cat > /etc/unbound/unbound.conf.d/sentinel.conf << UBEOF
server:
  interface: 0.0.0.0
  port: 53
  access-control: ${LAN_SUBNET} allow
  access-control: 10.8.0.0/24 allow
  access-control: 127.0.0.0/8 allow
  access-control: 0.0.0.0/0 refuse
  do-ip4: yes
  do-ip6: no
  do-udp: yes
  do-tcp: yes
  hide-identity: yes
  hide-version: yes
  harden-glue: yes
  harden-dnssec-stripped: yes
  use-caps-for-id: yes
  cache-min-ttl: 60
  cache-max-ttl: 86400
  prefetch: yes
  num-threads: 2

forward-zone:
  name: "."
  forward-addr: 1.1.1.1
  forward-addr: 8.8.8.8
UBEOF

# Validate config before starting
if ! unbound-checkconf /etc/unbound/unbound.conf.d/sentinel.conf 2>&1; then
  error "Unbound config validation failed — see above"
fi

systemctl enable unbound
systemctl restart unbound || {
  journalctl -u unbound --no-pager -n 20
  error "Unbound failed to start — see logs above"
}
ok "Unbound DNS configured"

# =============================================================================
# 8. WIREGUARD
# =============================================================================
info "Configuring WireGuard..."

mkdir -p /etc/wireguard
chmod 700 /etc/wireguard
WG_PRIVATE=$(wg genkey)
WG_PUBLIC=$(echo "$WG_PRIVATE" | wg pubkey)

cat > /etc/wireguard/wg0.conf << WGEOF
[Interface]
Address = 10.8.0.1/24
ListenPort = 51820
PrivateKey = ${WG_PRIVATE}
PostUp   = nft add element inet sentinel_firewall vpn_clients { 10.8.0.0/24 }
PostDown = nft delete element inet sentinel_firewall vpn_clients { 10.8.0.0/24 } 2>/dev/null || true

# Peers added via Sentinel dashboard
WGEOF
chmod 600 /etc/wireguard/wg0.conf

systemctl enable wg-quick@wg0
systemctl start wg-quick@wg0
ok "WireGuard configured"

# =============================================================================
# 9. SURICATA
# =============================================================================
info "Configuring Suricata..."

cat > /etc/suricata/suricata-sentinel.yaml << SUREOF
%YAML 1.1
---
default-log-dir: /var/log/suricata/

outputs:
  - eve-log:
      enabled: yes
      filetype: regular
      filename: eve.json
      types:
        - alert:
            payload: yes
            payload-printable: yes
            metadata: yes
        - stats:
            totals: yes

af-packet:
  - interface: ${WAN_IF}
    threads: auto
    cluster-id: 99
    cluster-type: cluster_flow
    defrag: yes

app-layer:
  protocols:
    http:
      enabled: yes
    tls:
      enabled: yes
    dns:
      enabled: yes
SUREOF

suricata-update 2>&1 | tail -5 || warn "suricata-update failed — rules may be outdated"
systemctl enable suricata
systemctl restart suricata
ok "Suricata configured"

# =============================================================================
# 10. PYTHON VENV + BACKEND
# =============================================================================
info "Setting up Python environment..."

mkdir -p "$INSTALL_DIR"
cp -r "$SRC_DIR"/* "$INSTALL_DIR/" 2>/dev/null || true

python3.12 -m venv "$INSTALL_DIR/.venv"
"$INSTALL_DIR/.venv/bin/pip" install --quiet --upgrade pip
"$INSTALL_DIR/.venv/bin/pip" install --quiet -r "$INSTALL_DIR/backend/requirements.txt"
ok "Python venv ready"

# =============================================================================
# 11. FRONTEND BUILD + NGINX
# =============================================================================
info "Building frontend..."

cd "$INSTALL_DIR/frontend"
npm ci --silent
npm run build --silent
ok "Frontend built"

# SSL self-signed
mkdir -p /etc/nginx/ssl
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/sentinel.key \
  -out /etc/nginx/ssl/sentinel.crt \
  -subj "/CN=${LAN_GW}" 2>/dev/null

cat > /etc/nginx/sites-available/sentinel << NGINXEOF
server {
  listen 80 default_server;
  return 301 https://\$host\$request_uri;
}
server {
  listen 443 ssl default_server;
  ssl_certificate     /etc/nginx/ssl/sentinel.crt;
  ssl_certificate_key /etc/nginx/ssl/sentinel.key;
  ssl_protocols       TLSv1.2 TLSv1.3;
  root ${INSTALL_DIR}/frontend/dist;
  index index.html;
  location / {
    try_files \$uri \$uri/ /index.html;
  }
  location /api/ {
    proxy_pass         http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade \$http_upgrade;
    proxy_set_header   Connection keep-alive;
    proxy_set_header   Host \$host;
    proxy_cache_bypass \$http_upgrade;
  }
  location /ws {
    proxy_pass         http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade \$http_upgrade;
    proxy_set_header   Connection "Upgrade";
  }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/sentinel /etc/nginx/sites-enabled/sentinel
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx
ok "Nginx configured with SSL"

# =============================================================================
# 12. SENTINEL CONFIG
# =============================================================================
info "Writing Sentinel configuration..."

mkdir -p "$CONF_DIR"
chmod 750 "$CONF_DIR"

cat > "$CONF_DIR/sentinel.toml" << CFGEOF
[network]
wan_interface = "${WAN_IF}"
lan_interface = "${LAN_IF}"
lan_subnet    = "${LAN_SUBNET}"
lan_gateway   = "${LAN_GW}"
public_ip     = "${PUBLIC_IP}"

[api]
host = "127.0.0.1"
port = 8000
cors_origins = ["https://${LAN_GW}", "http://localhost:3000"]

[ids]
auto_block           = false
confidence_threshold = 80
eve_log              = "/var/log/suricata/eve.json"

[scanner]
enabled = true
schedule = "03:00"
target   = "lan"
ports    = "1-1024"

[dhcp]
kea_socket   = "/run/kea/kea4-ctrl-socket"
kea_ctrl_url = "http://127.0.0.1:8001/"
lease_file   = "/var/lib/kea/kea-leases4.csv"

[dns]
unbound_conf = "/etc/unbound/unbound.conf.d/sentinel.conf"
forwarders   = ["1.1.1.1", "8.8.8.8"]

[vpn]
wg_interface = "wg0"
wg_conf      = "/etc/wireguard/wg0.conf"
listen_port  = 51820
dns_server   = "${LAN_GW}"

[notifications]
email_enabled    = false
telegram_enabled = false
CFGEOF

JWT_SECRET=$(openssl rand -hex 32)
ADMIN_HASH=$("$INSTALL_DIR/.venv/bin/python3" -c \
  "from passlib.context import CryptContext; ctx=CryptContext(schemes=['bcrypt']); print(ctx.hash('${ADMIN_PASS}'))")

cat > "$CONF_DIR/secrets.toml" << SECEOF
[auth]
admin_password_hash = "${ADMIN_HASH}"
jwt_secret          = "${JWT_SECRET}"
jwt_algorithm       = "HS256"
jwt_expire_minutes  = 720
SECEOF
chmod 600 "$CONF_DIR/secrets.toml"

ok "Configuration written to $CONF_DIR"

# =============================================================================
# 13. SYSTEMD SERVICES
# =============================================================================
info "Installing systemd services..."

cp "$INSTALL_DIR/systemd/"*.service "$INSTALL_DIR/systemd/"*.timer /etc/systemd/system/ 2>/dev/null || true
systemctl daemon-reload
systemctl enable sentinel-api sentinel-ids sentinel-scanner.timer
systemctl start sentinel-api

for i in $(seq 1 10); do
  curl -sf http://127.0.0.1:8000/api/system/health > /dev/null && break
  sleep 2
done

systemctl start sentinel-ids
ok "Systemd services enabled and started"

# =============================================================================
# COMPLETE
# =============================================================================
echo
echo -e "${GREEN}${BOLD}================================================================${RESET}"
echo -e "${GREEN}${BOLD}  Sentinel Firewall installed successfully!${RESET}"
echo -e "${GREEN}${BOLD}================================================================${RESET}"
echo
echo -e "  Dashboard: ${CYAN}https://${LAN_GW}${RESET}"
echo -e "  API:       ${CYAN}http://127.0.0.1:8000${RESET}"
echo
echo -e "  WAN interface: ${BOLD}${WAN_IF}${RESET}"
echo -e "  LAN interface: ${BOLD}${LAN_IF}${RESET}  (${LAN_SUBNET})"
echo -e "  DHCP range:    ${BOLD}${DHCP_START} — ${DHCP_END}${RESET}"
echo
echo -e "${YELLOW}  Note: Self-signed SSL — accept the browser warning.${RESET}"
echo
