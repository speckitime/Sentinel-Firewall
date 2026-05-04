# NAT & Port-Weiterleitung — Leitfaden

## Was ist NAT?

**NAT (Network Address Translation)** übersetzt IP-Adressen zwischen verschiedenen Netzwerken. In einem typischen Home-Lab-Setup hast du:

- **Eine öffentliche IP** (von deinem ISP, z.B. `203.0.113.1`)
- **Viele private IPs** in deinem LAN (z.B. `192.168.1.10`, `192.168.1.20`, ...)

NAT ermöglicht es, dass alle privaten Geräte unter einer einzigen öffentlichen IP ins Internet kommunizieren.

## Masquerading — Automatischer Internet-Zugang

**Masquerading** ist eine spezielle Form von NAT für dynamische öffentliche IPs. Wenn ein LAN-Gerät eine Anfrage ins Internet schickt:

```
 LAN-Gerät         Sentinel Firewall         Internet
 192.168.1.10  →  203.0.113.1 (WAN-IP)  →  google.com
                 (Source-NAT / Masquerade)
```

Sentinel konfiguriert dies automatisch beim Setup. **Alle DHCP-Clients** bekommen sofort Internet-Zugang.

### nftables-Regel dahinter
```nft
table ip sentinel_nat {
    chain postrouting {
        type nat hook postrouting priority srcnat;
        
        # Alle LAN-Pakete werden mit WAN-IP maskiert
        ip saddr 192.168.1.0/24 oif eth0 masquerade
    }
}
```

## Port-Weiterleitung (DNAT)

Port-Weiterleitung ermöglicht es, **einzelne Ports** von der WAN-IP an ein internes Gerät weiterzuleiten.

**Beispiel:** Du willst deinen Webserver (192.168.1.10) von außen erreichbar machen:

```
 Internet         Sentinel         LAN-Webserver
 :443        →    DNAT       →    192.168.1.10:443
```

### Port-Weiterleitung einrichten (Dashboard)

1. Dashboard öffnen: `https://192.168.1.1`
2. Menü: **NAT / Portweiterleitung**
3. **Regel hinzufügen** klicken
4. Felder ausfüllen:
   - **Name:** `Webserver`
   - **Protokoll:** `TCP`
   - **Öffentlicher Port:** `443`
   - **Internes Gerät:** `192.168.1.10` (aus DHCP-Liste wählen)
   - **Interner Port:** `443`
5. **Speichern**

Die Änderung wird sofort atomar in nftables übernommen.

### nftables-Regel dahinter
```nft
table ip sentinel_nat {
    chain prerouting {
        type nat hook prerouting priority dstnat;
        
        # SENTINEL_DNAT_START
        tcp dport 443 dnat to 192.168.1.10:443
        # SENTINEL_DNAT_END
    }
}
```

## Typische Anwendungsfälle

### Webserver (HTTP/HTTPS)
| Feld | Wert |
|------|------|
| Protokoll | TCP |
| Öffentlicher Port | 80 |
| Interner Port | 80 |

Falls HTTPS:
| Öffentlicher Port | 443 |
| Interner Port | 443 |

### Minecraft-Server
| Feld | Wert |
|------|------|
| Protokoll | TCP |
| Öffentlicher Port | 25565 |
| Interner Port | 25565 |

### Remote Desktop (RDP)
| Feld | Wert |
|------|------|
| Protokoll | TCP |
| Öffentlicher Port | 3389 |
| Interner Port | 3389 |

> **Sicherheitshinweis:** RDP direkt ins Internet zu öffnen ist riskant. Nutze stattdessen WireGuard VPN + RDP nur über VPN.

### Nextcloud / NAS
| Feld | Wert |
|------|------|
| Protokoll | TCP |
| Öffentlicher Port | 8443 |
| Interner Port | 443 |

## Sicherheitshinweise

1. **Minimale Ports öffnen:** Nur was wirklich benötigt wird.
2. **SSH nicht direkt öffnen:** Nutze WireGuard VPN stattdessen.
3. **RDP/VNC nie direkt ins Internet:** Immer hinter VPN.
4. **Fail2Ban / Rate-Limiting:** Sentinel aktiviert automatisch Rate-Limits für SSH.
5. **IDS aktivieren:** Suricata erkennt Angriffe auf geöffnete Ports.

## Debugging Port-Weiterleitungen

```bash
# Aktuelle DNAT-Regeln anzeigen
nft list chain ip sentinel_nat prerouting

# Verbindungen verfolgen (Connection Tracking)
nft list table ip sentinel_nat

# NAT-Verbindungen in Echtzeit
watch -n1 'conntrack -L -n 2>/dev/null | grep DNAT | head -20'

# Von außen testen (von anderem Gerät)
curl -v https://DEINE-PUBLIC-IP:443
nmap -p 443 DEINE-PUBLIC-IP
```

## Technische Details: Marker-System

Sentinel verwendet Kommentar-Marker in `/etc/nftables.conf` um Port-Weiterleitungen dynamisch einzufügen, ohne die gesamte Firewall-Konfiguration zu ersetzen:

```
# SENTINEL_DNAT_START
tcp dport 443 dnat to 192.168.1.10:443
tcp dport 25565 dnat to 192.168.1.20:25565
# SENTINEL_DNAT_END
```

Bei jeder Änderung via Dashboard:
1. `nat.toml` wird aktualisiert
2. Marker-Bereich in `nftables.conf` wird ersetzt
3. `nft -f /etc/nftables.conf` wird atomar ausgeführt
4. Bei Fehler: Rollback zur vorherigen Konfiguration

**Niemals** die Marker manuell aus `nftables.conf` entfernen!
