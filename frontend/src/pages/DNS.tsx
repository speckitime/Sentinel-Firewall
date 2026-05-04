import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { api } from '../lib/api'

export default function DNS() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', record_type: 'A', value: '' })

  const { data: records = [] } = useQuery({ queryKey: ['dns-records'], queryFn: () => api.get('/dns/records').then(r => r.data) })
  const { data: cfg }          = useQuery({ queryKey: ['dns-config'],  queryFn: () => api.get('/dns/config').then(r => r.data) })

  const addMutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/dns/records', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dns-records'] }); setForm({ name: '', record_type: 'A', value: '' }) },
  })
  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.delete(`/dns/records/${name}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dns-records'] }),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">{t('dns.title')}</h1>

      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4">
        <h2 className="text-sm font-medium mb-2">{t('dns.forwarders')}</h2>
        <p className="font-mono text-sm text-sentinel-muted">{(cfg?.forwarders ?? []).join(', ') || '—'}</p>
      </div>

      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4">
        <h2 className="text-sm font-medium mb-3">{t('dns.records')}</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-sentinel-muted border-b border-sentinel-border">
            <th className="text-left py-2">{t('dns.name')}</th>
            <th className="text-left py-2">{t('dns.type')}</th>
            <th className="text-left py-2">{t('dns.value')}</th>
            <th />
          </tr></thead>
          <tbody>
            {(records as { name: string; type: string; value: string }[]).map((r) => (
              <tr key={r.name} className="border-b border-sentinel-border last:border-0">
                <td className="py-2 font-mono">{r.name}</td>
                <td className="py-2 font-mono text-xs">{r.type}</td>
                <td className="py-2 font-mono">{r.value}</td>
                <td className="py-2">
                  <button onClick={() => deleteMutation.mutate(r.name)} className="text-sentinel-muted hover:text-sentinel-danger"><Trash2 size={12} /></button>
                </td>
              </tr>
            ))}
            {records.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-sentinel-muted text-xs">—</td></tr>}
          </tbody>
        </table>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <input placeholder={t('dns.name')} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="bg-sentinel-bg border border-sentinel-border rounded px-3 py-2 text-sm outline-none focus:border-sentinel-primary" />
          <select value={form.record_type} onChange={(e) => setForm((f) => ({ ...f, record_type: e.target.value }))}
            className="bg-sentinel-bg border border-sentinel-border rounded px-3 py-2 text-sm outline-none">
            {['A','AAAA','CNAME','MX','TXT'].map(t => <option key={t}>{t}</option>)}
          </select>
          <input placeholder={t('dns.value')} value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
            className="bg-sentinel-bg border border-sentinel-border rounded px-3 py-2 text-sm outline-none focus:border-sentinel-primary" />
        </div>
        <button onClick={() => addMutation.mutate(form)} disabled={!form.name || !form.value}
          className="mt-2 bg-sentinel-primary hover:bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50">
          {t('common.add')}
        </button>
      </div>
    </div>
  )
}
