import React from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldOff, CheckCircle } from 'lucide-react'
import api from '../lib/api'
import StatusBadge from '../components/common/StatusBadge'

const SEVERITY_LABEL: Record<number, string> = { 1: 'high', 2: 'medium', 3: 'low' }
const SEVERITY_VARIANT: Record<string, 'blocked' | 'warning' | 'active'> = {
  high: 'blocked',
  medium: 'warning',
  low: 'active',
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-sentinel-danger' : value >= 50 ? 'bg-sentinel-warning' : 'bg-sentinel-success'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-sentinel-border rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-sentinel-muted w-8 text-right">{value}%</span>
    </div>
  )
}

export default function Threats() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['threats-alerts'],
    queryFn: () => api.get('/threats/alerts?limit=100').then((r) => r.data),
    refetchInterval: 10_000,
  })

  const blockMutation = useMutation({
    mutationFn: (ip: string) => api.post(`/firewall/block/${ip}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['threats-alerts'] }),
  })

  const ackMutation = useMutation({
    mutationFn: (id: string) => api.post(`/threats/alerts/${id}/acknowledge`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['threats-alerts'] }),
  })

  const alerts: Record<string, unknown>[] = data?.alerts ?? []

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-sentinel-text">{t('threats.alerts')}</h2>
          <span className="text-xs text-sentinel-muted">{data?.count ?? 0} alerts</span>
        </div>

        {isLoading ? (
          <p className="text-sentinel-muted text-sm">{t('common.loading')}</p>
        ) : alerts.length === 0 ? (
          <p className="text-sentinel-muted text-sm">{t('threats.no_alerts')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-sentinel-muted border-b border-sentinel-border text-left">
                  <th className="pb-2 pr-3 font-medium">{t('threats.timestamp')}</th>
                  <th className="pb-2 pr-3 font-medium">{t('threats.signature')}</th>
                  <th className="pb-2 pr-3 font-medium">{t('threats.src_ip')}</th>
                  <th className="pb-2 pr-3 font-medium">{t('threats.severity')}</th>
                  <th className="pb-2 pr-3 font-medium">{t('threats.confidence')}</th>
                  <th className="pb-2 font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert, idx) => {
                  const sevKey = SEVERITY_LABEL[Number(alert.severity)] ?? 'low'
                  return (
                    <tr key={idx} className={`table-row ${alert.acknowledged ? 'opacity-50' : ''}`}>
                      <td className="py-2 pr-3 text-sentinel-muted text-xs font-mono">
                        {String(alert.timestamp).slice(0, 19)}
                      </td>
                      <td className="py-2 pr-3 text-white max-w-xs truncate">{String(alert.signature)}</td>
                      <td className="py-2 pr-3 text-sentinel-text font-mono text-xs">{String(alert.src_ip)}</td>
                      <td className="py-2 pr-3">
                        <StatusBadge
                          variant={SEVERITY_VARIANT[sevKey]}
                          label={t(`threats.severity_${sevKey}`)}
                        />
                      </td>
                      <td className="py-2 pr-3 w-32">
                        <ConfidenceBar value={Number(alert.confidence)} />
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => blockMutation.mutate(String(alert.src_ip))}
                            className="p-1.5 rounded text-sentinel-muted hover:text-sentinel-danger hover:bg-sentinel-border transition-colors"
                            title={t('threats.block_ip')}
                          >
                            <ShieldOff size={14} />
                          </button>
                          <button
                            onClick={() => ackMutation.mutate(String(alert.id))}
                            className="p-1.5 rounded text-sentinel-muted hover:text-sentinel-success hover:bg-sentinel-border transition-colors"
                            title={t('threats.acknowledge')}
                          >
                            <CheckCircle size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
