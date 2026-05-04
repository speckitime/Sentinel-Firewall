import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldOff } from 'lucide-react'
import { api } from '../lib/api'
import StatusBadge from '../components/common/StatusBadge'

const CONFIDENCE_VARIANT = (c: number) =>
  c >= 80 ? 'critical' : c >= 60 ? 'warning' : c >= 40 ? 'inactive' : 'unknown'

export default function Threats() {
  const { t } = useTranslation()
  const qc = useQueryClient()

  const { data: threats = [] } = useQuery({ queryKey: ['threats'], queryFn: () => api.get('/threats/recent').then(r => r.data) })
  const { data: stats }        = useQuery({ queryKey: ['threat-stats'], queryFn: () => api.get('/threats/stats').then(r => r.data) })

  const blockMutation = useMutation({
    mutationFn: (ip: string) => api.post(`/threats/block/${ip}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['threats'] }),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">{t('threats.title')}</h1>

      <div className="grid grid-cols-4 gap-4">
        {[['total','total'],['blocked','blocked'],['alerted','alerted'],['rate_limited','rate_limited']].map(([k,l]) => (
          <div key={k} className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4">
            <p className="text-xs text-sentinel-muted mb-1">{l}</p>
            <p className="text-2xl font-bold">{stats?.[k] ?? '—'}</p>
          </div>
        ))}
      </div>

      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4">
        <h2 className="text-sm font-medium mb-3">{t('threats.recent')}</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-sentinel-muted border-b border-sentinel-border">
            <th className="text-left py-2">{t('threats.timestamp')}</th>
            <th className="text-left py-2">{t('threats.src_ip')}</th>
            <th className="text-left py-2">{t('threats.signature')}</th>
            <th className="text-left py-2">{t('threats.confidence')}</th>
            <th className="text-left py-2">{t('threats.action')}</th>
            <th />
          </tr></thead>
          <tbody>
            {(threats as { src_ip: string; signature: string; confidence: number; action: string; timestamp: string }[]).map((th, i) => (
              <tr key={i} className="border-b border-sentinel-border last:border-0">
                <td className="py-2 text-xs text-sentinel-muted">{new Date(th.timestamp).toLocaleTimeString()}</td>
                <td className="py-2 font-mono text-xs">{th.src_ip}</td>
                <td className="py-2 text-xs max-w-xs truncate">{th.signature}</td>
                <td className="py-2"><StatusBadge variant={CONFIDENCE_VARIANT(th.confidence)} label={`${th.confidence}%`} /></td>
                <td className="py-2 font-mono text-xs">{th.action}</td>
                <td className="py-2">
                  <button onClick={() => blockMutation.mutate(th.src_ip)} className="text-sentinel-muted hover:text-sentinel-danger" title={t('threats.block_manual')}>
                    <ShieldOff size={12} />
                  </button>
                </td>
              </tr>
            ))}
            {threats.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-sentinel-muted text-xs">—</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
