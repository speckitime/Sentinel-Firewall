import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Wifi, WifiOff } from 'lucide-react'

const PAGE_TITLE_MAP: Record<string, string> = {
  '/': 'dashboard.title',
  '/firewall': 'firewall.title',
  '/nat': 'nat.title',
  '/dhcp': 'dhcp.title',
  '/dns': 'dns.title',
  '/vpn': 'vpn.title',
  '/threats': 'threats.title',
  '/settings': 'settings.title',
}

export default function TopBar() {
  const { t } = useTranslation()
  const location = useLocation()
  const [wsConnected, setWsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  const title = t(PAGE_TITLE_MAP[location.pathname] ?? 'dashboard.title')

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
    wsRef.current = ws

    ws.onopen = () => setWsConnected(true)
    ws.onclose = () => setWsConnected(false)
    ws.onerror = () => setWsConnected(false)

    return () => {
      ws.close()
    }
  }, [])

  return (
    <header className="bg-sentinel-surface border-b border-sentinel-border px-6 py-3 flex items-center justify-between flex-shrink-0">
      <h1 className="text-lg font-semibold text-sentinel-text">{title}</h1>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs">
          {wsConnected ? (
            <><Wifi size={14} className="text-sentinel-success" />
            <span className="text-sentinel-success">{t('status.connected')}</span></>
          ) : (
            <><WifiOff size={14} className="text-sentinel-muted" />
            <span className="text-sentinel-muted">{t('status.disconnected')}</span></>
          )}
        </div>
        <div className="w-8 h-8 rounded-full bg-sentinel-primary flex items-center justify-center text-white text-xs font-bold">
          A
        </div>
      </div>
    </header>
  )
}
