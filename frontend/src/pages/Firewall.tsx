import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { api } from '../lib/api'

export default function Firewall() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [ip, setIp]         = useState('')
  const [reason, setReason] = useState('')

  const { data: blocked = [] } = useQuery({
    queryKey: ['blocked'],
    queryFn: () => api.get('/firewall/blocked').then(r => r.data),
  })

  const blockMutation = useMutation({
    mutationFn: (data: { ip: string; reason: string }) => api.post('/firewall/block', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['blocked'] }); setIp(''); setReason('') },
  })

  const unblockMutation = useMutation({
    mutationFn: (ipAddr: string) => api.delete(`/firewall/block/${ipAddr}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blocked'] }),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">{t('firewall.title')}</h1>

      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4">
        <h2 className="text-sm font-medium mb-3">{t('firewall.block_ip')}</h2>
        <div className="flex gap-2">
          <input
            placeholder={t('firewall.ip_address')}
            value={ip} onChange={(e) => setIp(e.target.value)}
            className="flex-1 bg-sentinel-bg border border-sentinel-border rounded px-3 py-2 text-sm outline-none focus:border-sentinel-primary"
          />
          <input
            placeholder={t('firewall.reason')}
            value={reason} onChange={(e) => setReason(e.target.value)}
            className="flex-1 bg-sentinel-bg border border-sentinel-border rounded px-3 py-2 text-sm outline-none focus:border-sentinel-primary"
          />
          <button
            onClick={() => blockMutation.mutate({ ip, reason })}
            disabled={!ip}
            className="bg-sentinel-danger hover:bg-red-600 text-white rounded px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {t('firewall.block_ip')}
          </button>
        </div>
      </div>

      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4">
        <h2 className="text-sm font-medium mb-3">{t('firewall.blocked_ips')}</h2>
        <div className="space-y-2">
          {(blocked as string[]).map((ipAddr) => (
            <div key={ipAddr} className="flex items-center justify-between py-2 border-b border-sentinel-border last:border-0">
              <span className="font-mono text-sm">{ipAddr}</span>
              <button
                onClick={() => unblockMutation.mutate(ipAddr)}
                className="flex items-center gap-1 text-xs text-sentinel-danger hover:text-red-400 transition-colors"
              >
                <Trash2 size={12} /> {t('firewall.unblock')}
              </button>
            </div>
          ))}
          {blocked.length === 0 && <p className="text-sm text-sentinel-muted">—</p>}
        </div>
      </div>
    </div>
  )
}
