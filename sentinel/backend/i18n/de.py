"""Deutsche Backend-Meldungen."""

MESSAGES: dict[str, str] = {
    # Firewall
    "ip_blocked": "IP-Adresse {ip} wurde blockiert.",
    "ip_unblocked": "IP-Adresse {ip} wurde entsperrt.",
    "rule_added": "Firewall-Regel erfolgreich hinzugefügt.",
    "rule_deleted": "Firewall-Regel gelöscht.",
    "ruleset_applied": "nftables Regelwerk erfolgreich angewendet.",
    "ruleset_error": "Fehler beim Anwenden des nftables Regelwerks: {error}",
    # NAT
    "nat_rule_added": "Port-Weiterleitung hinzugefügt: {wan_port}/{protocol} → {lan_ip}:{lan_port}",
    "nat_rule_deleted": "Port-Weiterleitung gelöscht: {name}",
    "nat_rule_conflict": "Externer Port {port}/{protocol} ist bereits belegt.",
    "nat_rule_invalid_ip": "Ziel-IP {ip} ist nicht im LAN-Subnetz.",
    "dnat_rules_injected": "DNAT-Regeln in nftables eingefügt ({count} aktive Regeln).",
    # DHCP
    "dhcp_lease_new": "Neuer DHCP-Client: {hostname} ({mac}) → {ip}",
    "dhcp_reservation_added": "Statische Reservierung hinzugefügt: {mac} → {ip}",
    "dhcp_reservation_deleted": "Statische Reservierung gelöscht: {mac}",
    # DNS
    "dns_zone_added": "DNS-Zone hinzugefügt: {name} → {ip}",
    "dns_zone_deleted": "DNS-Zone gelöscht: {name}",
    "dns_reloaded": "Unbound DNS neu geladen.",
    # VPN
    "vpn_peer_added": "WireGuard-Peer '{name}' hinzugefügt.",
    "vpn_peer_deleted": "WireGuard-Peer '{name}' gelöscht.",
    "vpn_no_ips": "Keine verfügbaren IP-Adressen im VPN-Subnetz.",
    # IDS
    "threat_detected": "Bedrohung erkannt: {signature} von {src_ip} (Konfidenz: {confidence}%)",
    "threat_blocked": "Bedrohung blockiert: {src_ip} (Konfidenz: {confidence}%)",
    "threat_rate_limited": "Rate-Limit angewendet für {src_ip} (Konfidenz: {confidence}%)",
    "threat_alerted": "Alert für {src_ip}: {signature}",
    # Scanner
    "scan_started": "Port-Scan gestartet für {target}.",
    "scan_complete": "Port-Scan abgeschlossen. {count} offene Ports gefunden.",
    "scan_failed": "Port-Scan fehlgeschlagen: {error}",
    # System
    "setup_complete": "Sentinel Firewall erfolgreich eingerichtet.",
    "service_restarted": "Dienst {service} neu gestartet.",
    "config_updated": "Konfiguration aktualisiert.",
    # Auth
    "login_failed": "Ungültiger Benutzername oder Passwort.",
    "login_success": "Anmeldung erfolgreich.",
    "token_expired": "Authentifizierungstoken ist abgelaufen.",
}


def get(key: str, **kwargs: str) -> str:
    msg = MESSAGES.get(key, key)
    return msg.format(**kwargs) if kwargs else msg
