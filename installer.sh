#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Sentinel Firewall — Automated Installer
# Ubuntu 24.04 LTS | nftables + Kea + Unbound + WireGuard + Suricata
# =============================================================================

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
BOLD='\033[1m'; RESET='\033[0m'

INSTALL_DIR="/opt/sentinel"
CONF_DIR="/etc/sentinel"
REPO_URL="https://github.com/speckitime/Sentinel-Firewall.git"

info()  { echo -e "${CYAN}[INFO]${RESET}  $*"; }
ok()    { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error() { echo -e "${RED}[ERROR]${RESET} $*"; exit 1; }

# Wait for a service to become active, print journal on failure
wait_service() {
  local svc="$1" tries=0
  while ! systemctl is-active --quiet "$svc"; do
    tries=$((tries+1))
    [[ $tries -ge 10 ]] && {
      echo
      journalctl -u "$svc" --no-pager -n 30
      error "Service '$svc' failed to start — see logs above"
    }
    sleep 1
  done
}

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
[[ ${#IFACES[@]} -lt 2 ]] && error "Need at least 2 network interfaces (found ${#IFACES[@]})"

echo "Available interfaces:"
for i in "${!IFACES[@]}"; do
  IFACE_IP=$(ip -4 addr show "${IFACES[$i]}" 2>/dev/null | grep -oP '(?<=inet )\S+' | head -1 || true)
  echo "  [$i] ${IFACES[$i]}  ${IFACE_IP:-no IPv4}"
done

read -rp "Select WAN interface [0-$((${#IFACES[@]}-1))]: " WAN_IDX
read -rp "Select LAN interface [0-$((${#IFACES[@]}-1))]: " LAN_IDX

[[ ! "$WAN_IDX" =~ ^[0-9]+$ ]] || [[ $WAN_IDX -ge ${#IFACES[@]} ]] && error "Invalid WAN index"
[[ ! "$LAN_IDX" =~ ^[0-9]+$ ]] || [[ $LAN_IDX -ge ${#IFACES[@]} ]] && error "Invalid LAN index"
[[ "$WAN_IDX" == "$LAN_IDX" ]] && error "WAN and LAN must be different interfaces"

WAN_IF="${IFACES[$WAN_IDX]}"
LAN_IF="${IFACES[$LAN_IDX]}"
ok "WAN=$WAN_IF  LAN=$LAN_IF"

# =============================================================================
# 3. IP CONFIGURATION
# =============================================================================
PUBLIC_IP=$(ip -4 addr show "$WAN_IF" | grep -oP '(?<=inet )\d+\.\d+\.\d+\.\d+' | head -1 || true)
[[ -z "$PUBLIC_IP" ]] && PUBLIC_IP="(dynamic)"

while true; do
  read -rp "LAN subnet [default: 10.0.1.0/24]: " LAN_SUBNET
  LAN_SUBNET="${LAN_SUBNET:-10.0.1.0/24}"
  # Basic CIDR validation
  if [[ "$LAN_SUBNET" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}/([0-9]|[1-2][0-9]|3[0-2])$ ]]; then
    break
  fi
  warn "Invalid subnet format. Use CIDR notation, e.g. 192.168.1.0/24"
done

IFS='/' read -r NET_ADDR CIDR <<< "$LAN_SUBNET"
IFS='.' read -r a b c d <<< "$NET_ADDR"
LAN_GW="${a}.${b}.${c}.$((d+1))"
DHCP_START="${a}.${b}.${c}.$((d+100))"
DHCP_END="${a}.${b}.${c}.$((d+200))"

while true; do
  read -rsp "Admin password (min 8 chars): " ADMIN_PASS; echo
  [[ ${#ADMIN_PASS} -lt 8 ]] && { warn "Password too short"; continue; }
  read -rsp "Confirm password: " ADMIN_PASS2; echo
  [[ "$ADMIN_PASS" != "$ADMIN_PASS2" ]] && { warn "Passwords do not match"; continue; }
  break
done

ok "LAN gateway: $LAN_GW  |  DHCP: $DHCP_START — $DHCP_END"

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
  net-tools curl jq psmisc git
ok "Packages installed"

# =============================================================================
# 5. LAN INTERFACE IP
# =============================================================================
info "Configuring LAN interface $LAN_IF = $LAN_GW/$CIDR ..."

# Apply IP immediately
ip addr flush dev "$LAN_IF" 2>/dev/null || true
ip addr add "${LAN_GW}/${CIDR}" dev "$LAN_IF"
ip link set "$LAN_IF" up

# Remove any existing netplan configs that mention this interface to avoid conflicts
for f in /etc/netplan/*.yaml /etc/netplan/*.yml; do
  [[ -f "$f" ]] && grep -q "$LAN_IF" "$f" 2>/dev/null && {
    warn "Removing conflicting netplan config: $f"
    mv "$f" "${f}.pre-sentinel.bak"
  } || true
done

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
netplan apply 2>/dev/null || warn "netplan apply failed — static IP set via ip command (persists until reboot)"
ok "LAN interface configured: $LAN_IF = $LAN_GW/$CIDR"

# =============================================================================
# 6. NFTABLES
# =============================================================================
info "Configuring nftables..."

# Enable IP forwarding idempotently
if grep -q '^#*net.ipv4.ip_forward' /etc/sysctl.conf; then
  sed -i 's/^#*net.ipv4.ip_forward.*/net.ipv4.ip_forward=1/' /etc/sysctl.conf
else
  echo 'net.ipv4.ip_forward=1' >> /etc/sysctl.conf
fi
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

  # interval flag allows CIDR prefixes (populated by WireGuard PostUp)
  set vpn_clients {
    type ipv4_addr
    flags interval
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
# 7. KEA DHCP
# =============================================================================
info "Configuring Kea DHCP..."

mkdir -p /etc/kea
cat > /etc/kea/kea-dhcp4.conf << KEAEOF
{
  "Dhcp4": {
    "interfaces-config": { "interfaces": ["${LAN_IF}"] },
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
        {"name": "routers",            "data": "${LAN_GW}"},
        {"name": "domain-name-servers","data": "${LAN_GW}"},
        {"name": "domain-name",        "data": "sentinel.local"}
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
wait_service kea-dhcp4-server
wait_service kea-ctrl-agent
ok "Kea DHCP configured (control agent on port 8001)"

# =============================================================================
# 8. UNBOUND DNS
# =============================================================================
info "Configuring Unbound DNS..."

# Stop systemd-resolved and free port 53
systemctl stop systemd-resolved 2>/dev/null || true
systemctl disable systemd-resolved 2>/dev/null || true
fuser -k 53/tcp 2>/dev/null || true
fuser -k 53/udp 2>/dev/null || true
sleep 1
# Fix resolv.conf (systemd-resolved may have left a broken symlink)
rm -f /etc/resolv.conf
printf 'nameserver 127.0.0.1\nnameserver 1.1.1.1\n' > /etc/resolv.conf
ok "Port 53 freed"

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

unbound-checkconf /etc/unbound/unbound.conf 2>&1 || error "Unbound config syntax error — see above"
systemctl enable unbound
systemctl restart unbound
wait_service unbound
ok "Unbound DNS configured"

# =============================================================================
# 9. WIREGUARD
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

# Peers are added via the Sentinel dashboard
WGEOF
chmod 600 /etc/wireguard/wg0.conf

systemctl enable wg-quick@wg0
systemctl start wg-quick@wg0
wait_service wg-quick@wg0
ok "WireGuard configured (public key: $WG_PUBLIC)"

# =============================================================================
# 10. SURICATA
# =============================================================================
info "Configuring Suricata..."

# Write Sentinel-specific Suricata config
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
    http:  {enabled: yes}
    tls:   {enabled: yes}
    dns:   {enabled: yes}
SUREOF

suricata-update 2>&1 | tail -3 || warn "suricata-update failed — rules may be outdated"
systemctl enable suricata
systemctl restart suricata
wait_service suricata
ok "Suricata configured"

# =============================================================================
# 11. CLONE SOURCE CODE
# =============================================================================
info "Cloning Sentinel source code..."

if [[ -d "$INSTALL_DIR/.git" ]]; then
  git -C "$INSTALL_DIR" pull --quiet origin main
  ok "Source code updated"
else
  rm -rf "$INSTALL_DIR"
  git clone --depth=1 "$REPO_URL" "$INSTALL_DIR"
  ok "Source code cloned to $INSTALL_DIR"
fi

# =============================================================================
# 12. PYTHON VENV + BACKEND
# =============================================================================
info "Setting up Python environment..."

python3.12 -m venv "$INSTALL_DIR/.venv"
"$INSTALL_DIR/.venv/bin/pip" install --quiet --upgrade pip
"$INSTALL_DIR/.venv/bin/pip" install -r "$INSTALL_DIR/backend/requirements.txt"
ok "Python venv ready"

# =============================================================================
# 13. FRONTEND BUILD + NGINX
# =============================================================================
info "Building frontend..."

cd "$INSTALL_DIR/frontend"
# Use npm install (works without package-lock.json)
npm install 2>&1 || error "npm install failed — see above"
npm run build 2>&1 || error "npm run build failed — see above"
ok "Frontend built"

mkdir -p /etc/nginx/ssl
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/sentinel.key \
  -out /etc/nginx/ssl/sentinel.crt \
  -subj "/CN=${LAN_GW}" 2>/dev/null

# Remove default nginx site to avoid port 80/443 conflicts
rm -f /etc/nginx/sites-enabled/default

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
nginx -t || error "nginx config test failed"
systemctl enable nginx
systemctl restart nginx
wait_service nginx
ok "Nginx configured with SSL"

# =============================================================================
# 14. SENTINEL CONFIG
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
enabled  = true
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

# Hash password via temp file to safely handle special characters
JWT_SECRET=$(openssl rand -hex 32)
PASS_FILE=$(mktemp)
chmod 600 "$PASS_FILE"
printf '%s' "$ADMIN_PASS" > "$PASS_FILE"
ADMIN_HASH=$("$INSTALL_DIR/.venv/bin/python3" - "$PASS_FILE" << 'PYEOF'
import sys
from passlib.context import CryptContext
ctx = CryptContext(schemes=["bcrypt"])
print(ctx.hash(open(sys.argv[1]).read()))
PYEOF
)
rm -f "$PASS_FILE"

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
# 15. SYSTEMD SERVICES
# =============================================================================
info "Installing systemd services..."

cp "$INSTALL_DIR/systemd/"*.service /etc/systemd/system/ 2>/dev/null || true
cp "$INSTALL_DIR/systemd/"*.timer  /etc/systemd/system/ 2>/dev/null || true
systemctl daemon-reload
systemctl enable sentinel-api sentinel-ids sentinel-scanner.timer

# Start API and wait up to 20 s for health endpoint
systemctl start sentinel-api || true
API_OK=false
for i in $(seq 1 10); do
  sleep 2
  if curl -sf http://127.0.0.1:8000/api/system/health > /dev/null 2>&1; then
    API_OK=true; break
  fi
done

if $API_OK; then
  systemctl start sentinel-ids || warn "sentinel-ids failed to start — check: journalctl -u sentinel-ids"
  ok "Sentinel API running"
else
  warn "Sentinel API did not respond in time."
  warn "Check with: journalctl -u sentinel-api -n 30"
fi

# =============================================================================
# COMPLETE
# =============================================================================
echo
echo -e "${GREEN}${BOLD}================================================================${RESET}"
echo -e "${GREEN}${BOLD}  Sentinel Firewall installed!${RESET}"
echo -e "${GREEN}${BOLD}================================================================${RESET}"
echo
echo -e "  Dashboard:     ${CYAN}https://${LAN_GW}${RESET}"
echo -e "  WAN:           ${BOLD}${WAN_IF}${RESET}  (${PUBLIC_IP})"
echo -e "  LAN:           ${BOLD}${LAN_IF}${RESET}  (${LAN_GW}/${CIDR})"
echo -e "  DHCP range:    ${BOLD}${DHCP_START} — ${DHCP_END}${RESET}"
echo -e "  WireGuard key: ${BOLD}${WG_PUBLIC}${RESET}"
echo
echo -e "  Service status:"
for svc in nftables kea-dhcp4-server unbound wg-quick@wg0 suricata nginx sentinel-api; do
  if systemctl is-active --quiet "$svc" 2>/dev/null; then
    echo -e "    ${GREEN}✓${RESET} $svc"
  else
    echo -e "    ${RED}✗${RESET} $svc  (journalctl -u $svc)"
  fi
done
echo
echo -e "${YELLOW}  Note: Self-signed SSL — accept the browser security warning.${RESET}"
echo
