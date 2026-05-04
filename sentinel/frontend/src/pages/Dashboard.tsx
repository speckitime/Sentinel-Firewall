import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Shield, Users, Globe, Lock, AlertTriangle, Activity } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../lib/api'
import StatusBadge from '../components/common/StatusBadge'
import ThreatCard from '../components/common/ThreatCard'

type TrafficPoint = { time: string; rx: number; tx: number }

export default function Dashboard() {
  const { t } = useTranslation()
  const [traffic, setTraffic] = useState<TrafficPoint[]>([])

  const { data: systemData } = useQuery({
    queryKey: ['system-status'],
    queryFn: () => api.get('/system/status').then((r) => r.data),
    refetchInterval: 10_000,
  })

  const { data: threatsData } = useQuery({
    queryKey: ['threats-recent'],
    queryFn: () => api.get('/threats/alerts?limit=5').then((r) => r.data),
    refetchInterval: 15_000,
  })

  const { data: dhcpData } = useQuery({
    queryKey: ['dhcp-leases'],
    queryFn: () => api.get('/dhcp/leases').then((r) => r.data),
    refetchInterval: 30_000,
  })

  // WebSocket for live traffic
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'traffic') {
          const total = Object.values(msg.data as Record<string, { rx_bps: number; tx_bps: number }>)
          const rx = total.reduce((s, v) => s + v.rx_bps, 0)
          const tx = total.reduce((s, v) => s + v.tx_bps, 0)
          const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          setTraffic((prev) => [...prev.slice(-29), { time, rx: Math.round(rx / 1024), tx: Math.round(tx / 1024) }])
        }
      } catch { /* ignore */ }
    }
    return () => ws.close()
  }, [])

  const stats = [
    {
      label: t('dashboard.active_clients'),
      value: dhcpData?.leases?.length ?? '—',
      icon: Users,
      color: 'text-sentinel-primary',
    },
    {
      label: t('dashboard.vpn_peers'),
      value: '—',
      icon: Lock,
      color: 'text-sentinel-success',
    },
    {
      label: t('dashboard.blocked_today'),
      value: threatsData?.count ?? 0,
      icon: Shield,
      color: 'text-sentinel-danger',
    },
    {
      label: t('dashboard.open_ports'),
      value: '—',
      icon: Globe,
      color: 'text-sentinel-warning',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sentinel-muted text-sm">{label}</p>
                <p className="text-2xl font-bold text-white mt-1">{value}</p>
              </div>
              <Icon size={32} className={`${color} opacity-80`} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Traffic chart */}
        <div className="card lg:col-span-2">
          <h2 className="text-sm font-semibold text-sentinel-text mb-4 flex items-center gap-2">
            <Activity size={16} className="text-sentinel-primary" />
            {t('dashboard.traffic')}
          </h2>
          {traffic.length > 1 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={traffic}>
                <XAxis dataKey="time" tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} unit=" KB/s" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', border: 'none', borderRadius: 8 }}
                  labelStyle={{ color: '#E2E8F0' }}
                />
                <Line type="monotone" dataKey="rx" stroke="#3B82F6" strokeWidth={2} dot={false} name="RX" />
                <Line type="monotone" dataKey="tx" stroke="#10B981" strokeWidth={2} dot={false} name="TX" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-44 text-sentinel-muted text-sm">
              {t('common.loading')}
            </div>
          )}
        </div>

        {/* System status */}
        <div className="card">
          <h2 className="text-sm font-semibold text-sentinel-text mb-4">{t('dashboard.system_status')}</h2>
          {systemData ? (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-sentinel-muted">{t('dashboard.cpu')}</span>
                <span className="text-white">{systemData.cpu_percent?.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-sentinel-border rounded-full h-1.5">
                <div
                  className="bg-sentinel-primary h-1.5 rounded-full transition-all"
                  style={{ width: `${systemData.cpu_percent ?? 0}%` }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-sentinel-muted">{t('dashboard.memory')}</span>
                <span className="text-white">{systemData.memory_percent?.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-sentinel-border rounded-full h-1.5">
                <div
                  className="bg-sentinel-success h-1.5 rounded-full transition-all"
                  style={{ width: `${systemData.memory_percent ?? 0}%` }}
                />
              </div>
              <div className="pt-2 border-t border-sentinel-border">
                <StatusBadge variant="active" label={t('status.protected')} />
              </div>
            </div>
          ) : (
            <p className="text-sentinel-muted text-sm">{t('common.loading')}</p>
          )}
        </div>
      </div>

      {/* Recent threats */}
      <div className="card">
        <h2 className="text-sm font-semibold text-sentinel-text mb-4 flex items-center gap-2">
          <AlertTriangle size={16} className="text-sentinel-warning" />
          {t('dashboard.recent_threats')}
        </h2>
        {threatsData?.alerts?.length ? (
          <div className="space-y-2">
            {threatsData.alerts.slice(0, 5).map((alert: Record<string, unknown>, idx: number) => (
              <ThreatCard key={idx} alert={alert} />
            ))}
          </div>
        ) : (
          <p className="text-sentinel-muted text-sm">{t('dashboard.no_threats')}</p>
        )}
      </div>
    </div>
  )
}
