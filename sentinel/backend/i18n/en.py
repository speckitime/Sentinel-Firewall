"""English backend messages."""

MESSAGES: dict[str, str] = {
    # Firewall
    "ip_blocked": "IP address {ip} has been blocked.",
    "ip_unblocked": "IP address {ip} has been unblocked.",
    "rule_added": "Firewall rule added successfully.",
    "rule_deleted": "Firewall rule deleted.",
    "ruleset_applied": "nftables ruleset applied successfully.",
    "ruleset_error": "Failed to apply nftables ruleset: {error}",
    # NAT
    "nat_rule_added": "Port forward added: {wan_port}/{protocol} → {lan_ip}:{lan_port}",
    "nat_rule_deleted": "Port forward deleted: {name}",
    "nat_rule_conflict": "External port {port}/{protocol} is already in use.",
    "nat_rule_invalid_ip": "Target IP {ip} is not in the LAN subnet.",
    "dnat_rules_injected": "DNAT rules injected into nftables ({count} active rules).",
    # DHCP
    "dhcp_lease_new": "New DHCP client: {hostname} ({mac}) → {ip}",
    "dhcp_reservation_added": "Static reservation added: {mac} → {ip}",
    "dhcp_reservation_deleted": "Static reservation deleted: {mac}",
    # DNS
    "dns_zone_added": "DNS zone added: {name} → {ip}",
    "dns_zone_deleted": "DNS zone deleted: {name}",
    "dns_reloaded": "Unbound DNS reloaded.",
    # VPN
    "vpn_peer_added": "WireGuard peer '{name}' added.",
    "vpn_peer_deleted": "WireGuard peer '{name}' deleted.",
    "vpn_no_ips": "No available IP addresses in VPN subnet.",
    # IDS
    "threat_detected": "Threat detected: {signature} from {src_ip} (confidence: {confidence}%)",
    "threat_blocked": "Threat blocked: {src_ip} (confidence: {confidence}%)",
    "threat_rate_limited": "Rate-limit applied to {src_ip} (confidence: {confidence}%)",
    "threat_alerted": "Alert issued for {src_ip}: {signature}",
    # Scanner
    "scan_started": "Port scan started for {target}.",
    "scan_complete": "Port scan complete. Found {count} open ports.",
    "scan_failed": "Port scan failed: {error}",
    # System
    "setup_complete": "Sentinel Firewall setup complete.",
    "service_restarted": "Service {service} restarted.",
    "config_updated": "Configuration updated.",
    # Auth
    "login_failed": "Invalid username or password.",
    "login_success": "Login successful.",
    "token_expired": "Authentication token has expired.",
}


def get(key: str, **kwargs: str) -> str:
    msg = MESSAGES.get(key, key)
    return msg.format(**kwargs) if kwargs else msg
