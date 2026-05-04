import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import api from '../lib/api'

export default function DNS() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [newIp, setNewIp] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['dns-zones'],
    queryFn: () => api.get('/dns/zones').then((r) => r.data),
  })

  const addMutation = useMutation({
    mutationFn: () => api.post('/dns/zones', { name: newName, ip: newIp }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dns-zones'] })
      setNewName('')
      setNewIp('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.delete(`/dns/zones/${name}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dns-zones'] }),
  })

  const zones: Record<string, unknown>[] = data?.zones ?? []

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-sm font-semibold text-sentinel-text mb-4">{t('dns.add_zone')}</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('dns.hostname')}
            className="input flex-1"
          />
          <input
            type="text"
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            placeholder={t('dns.ip')}
            className="input w-44"
          />
          <button
            className="btn-primary flex items-center gap-2"
            disabled={!newName.trim() || !newIp.trim()}
            onClick={() => addMutation.mutate()}
          >
            <Plus size={16} />
            {t('common.add')}
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold text-sentinel-text mb-4">{t('dns.local_zones')}</h2>
        {isLoading ? (
          <p className="text-sentinel-muted text-sm">{t('common.loading')}</p>
        ) : zones.length === 0 ? (
          <p className="text-sentinel-muted text-sm">{t('dns.no_zones')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-sentinel-muted border-b border-sentinel-border text-left">
                <th className="pb-2 pr-4 font-medium">{t('dns.hostname')}</th>
                <th className="pb-2 pr-4 font-medium">{t('dns.ip')}</th>
                <th className="pb-2 font-medium">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((zone, idx) => (
                <tr key={idx} className="table-row">
                  <td className="py-3 pr-4 font-mono text-xs text-white">{String(zone.name)}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-sentinel-muted">{String(zone.ip)}</td>
                  <td className="py-3">
                    <button
                      onClick={() => deleteMutation.mutate(String(zone.name))}
                      className="p-1.5 rounded text-sentinel-muted hover:text-sentinel-danger hover:bg-sentinel-border transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
