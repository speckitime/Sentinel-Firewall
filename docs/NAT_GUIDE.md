# NAT & Port Forwarding Guide

## How NAT Works in Sentinel

Sentinel uses nftables for both masquerading (outbound NAT) and DNAT (port forwarding).

### Masquerade (Outbound NAT)

All LAN clients automatically get internet access via masquerade:

```
ip saddr 10.0.1.0/24 oif "eth0" masquerade
```

This is configured automatically by the installer and enabled by default.

### Port Forwarding (DNAT)

Port forwards redirect incoming connections on the WAN interface to internal LAN hosts.

**Example:** Forward external port 8080 to internal web server at 10.0.1.100:80

```
tcp dport 8080 dnat to 10.0.1.100:80
```

## Adding Port Forwards via Dashboard

1. Open the **NAT & Port Forwarding** page
2. Click **Add Port Forward** or use a **Quick-Start Template**
3. Fill in:
   - **Name**: Descriptive label (e.g. "My Webserver")
   - **Protocol**: TCP, UDP, or both
   - **External Port**: Port number on the WAN interface
   - **Internal IP**: LAN IP of the target host
   - **Internal Port**: Port number on the target host
4. Click **Save**

The rule is applied immediately via `nft -f` (atomic reload).

## Quick-Start Templates

| Template | Ext. Port | Int. Port | Protocol |
|----------|-----------|-----------|----------|
| Web Server | 80 | 80 | TCP |
| Web Server HTTPS | 443 | 443 | TCP |
| Remote Desktop | 3389 | 3389 | TCP |
| Minecraft | 25565 | 25565 | TCP |

## nftables Marker System

Sentinel injects DNAT rules between marker comments in `/etc/nftables.conf`:

```nft
chain prerouting {
  type nat hook prerouting priority -100;
  # SENTINEL_DNAT_START
  tcp dport 8080 dnat to 10.0.1.100:80
  # SENTINEL_DNAT_END
}
```

The markers must not be removed manually.

## Security Notes

- Only IPs within the configured LAN subnet are accepted as internal targets
- Duplicate external ports on the same protocol are rejected
- All changes are atomic (written to a temp file, applied with `nft -f`, then cleaned up)
