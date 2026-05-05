import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api, wsUrl } from '../lib/api'
import StatusBadge from '../components/common/StatusBadge'

const MAX_POINTS = 60

export default function Dashboard() {
  const { t } = useTranslation()
  const [traffic, setTraffic] = useState<{ t: number; rx: number; tx: number }[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  const { data: statusData } = useQuery({ queryKey: ['status'], queryFn: () => api.get('/system/status').then(r => r.data) })
  const { data: threatStats } = useQuery({ queryKey: ['threat-stats'], queryFn: () => api.get('/threats/stats').then(r => r.data) })
  const { data: leases }      = useQuery({ queryKey: ['leases'], queryFn: () => api.get('/dhcp/leases').then(r => r.data) })
  const { data: vpnPeers }    = useQuery({ queryKey: ['vpn-peers'], queryFn: () => api.get('/vpn/peers').then(r => r.data) })

  useEffect(() => {
    const ws = new WebSocket(wsUrl())
    wsRef.current = ws
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type !== 'traffic') return
      const ifaces = Object.values(msg.interfaces as Record<string, { rx_bps: number; tx_bps: number }>)
      const rx = ifaces.reduce((s, i) => s + i.rx_bps, 0)
      const tx = ifaces.reduce((s, i) => s + i.tx_bps, 0)
      setTraffic((prev) => [...prev.slice(-MAX_POINTS + 1), { t: Date.now(), rx, tx }])
    }
    return () => ws.close()
  }, [])

  const statCards = [
    { label: t('dashboard.threats_today'), value: threatStats?.total ?? '—' },
    { label: t('dashboard.blocked_ips'),   value: threatStats?.blocked ?? '—' },
    { label: t('dashboard.active_leases'), value: (leases as unknown[])?.length ?? '—' },
    { label: t('dashboard.vpn_peers'),     value: (vpnPeers as unknown[])?.length ?? '—' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">{t('dashboard.title')}</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value }) => (
          <div key={label} className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4">
            <p className="text-xs text-sentinel-muted mb-1">{label}</p>
            <p className="text-2xl font-bold text-sentinel-text">{String(value)}</p>
          </div>
        ))}
      </div>

      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4">
        <p className="text-sm font-medium mb-4">{t('dashboard.traffic')}</p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={traffic}>
            <XAxis dataKey="t" hide />
            <YAxis hide />
            <Tooltip formatter={(v) => `${(Number(v) / 1024).toFixed(1)} KB/s`} />
            <Line type="monotone" dataKey="rx" stroke="#10B981" dot={false} strokeWidth={1.5} name="RX" />
            <Line type="monotone" dataKey="tx" stroke="#3B82F6" dot={false} strokeWidth={1.5} name="TX" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4">
        <p className="text-sm font-medium mb-3">{t('dashboard.system_health')}</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(statusData?.services ?? {}).map(([svc, state]) => (
            <div key={svc} className="flex items-center justify-between">
              <span className="text-xs text-sentinel-muted font-mono">{svc}</span>
              <StatusBadge variant={state === 'active' ? 'active' : 'inactive'} label={String(state)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
