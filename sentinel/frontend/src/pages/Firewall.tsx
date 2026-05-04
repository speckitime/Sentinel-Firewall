import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldOff, ShieldCheck, Plus } from 'lucide-react'
import api from '../lib/api'
import StatusBadge from '../components/common/StatusBadge'

export default function Firewall() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [newIp, setNewIp] = useState('')

  const { data: setsData, isLoading } = useQuery({
    queryKey: ['firewall-sets'],
    queryFn: () => api.get('/firewall/sets').then((r) => r.data),
    refetchInterval: 10_000,
  })

  const blockMutation = useMutation({
    mutationFn: (ip: string) => api.post(`/firewall/block/${ip}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['firewall-sets'] }); setNewIp('') },
  })

  const unblockMutation = useMutation({
    mutationFn: (ip: string) => api.delete(`/firewall/block/${ip}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['firewall-sets'] }),
  })

  const blockedIps: string[] = setsData?.blocked_ips ?? []

  return (
    <div className="space-y-6">
      {/* Block IP */}
      <div className="card">
        <h2 className="text-sm font-semibold text-sentinel-text mb-3">{t('firewall.block_ip')}</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            placeholder={t('firewall.ip_address')}
            className="input flex-1"
          />
          <button
            className="btn-danger flex items-center gap-2"
            disabled={!newIp.trim()}
            onClick={() => blockMutation.mutate(newIp.trim())}
          >
            <ShieldOff size={16} />
            {t('firewall.block_ip')}
          </button>
        </div>
      </div>

      {/* Blocked IPs */}
      <div className="card">
        <h2 className="text-sm font-semibold text-sentinel-text mb-4">{t('firewall.blocked_ips')}</h2>
        {isLoading ? (
          <p className="text-sentinel-muted text-sm">{t('common.loading')}</p>
        ) : blockedIps.length === 0 ? (
          <p className="text-sentinel-muted text-sm">{t('firewall.no_blocked')}</p>
        ) : (
          <div className="space-y-2">
            {blockedIps.map((ip, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-sentinel-bg rounded-lg border border-sentinel-border">
                <div className="flex items-center gap-3">
                  <StatusBadge variant="blocked" label="Blocked" />
                  <span className="font-mono text-sm text-white">{ip}</span>
                </div>
                <button
                  onClick={() => unblockMutation.mutate(ip)}
                  className="flex items-center gap-1.5 text-sm text-sentinel-muted hover:text-sentinel-success transition-colors"
                >
                  <ShieldCheck size={14} />
                  {t('firewall.unblock')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
