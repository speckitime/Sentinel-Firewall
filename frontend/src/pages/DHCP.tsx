import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { api } from '../lib/api'

export default function DHCP() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [form, setForm] = useState({ mac: '', ip: '', hostname: '' })

  const { data: leases = [] }  = useQuery({ queryKey: ['leases'],  queryFn: () => api.get('/dhcp/leases').then(r => r.data) })

  const addMutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/dhcp/static', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leases'] }); setForm({ mac: '', ip: '', hostname: '' }) },
  })
  const deleteMutation = useMutation({
    mutationFn: (mac: string) => api.delete(`/dhcp/static/${mac}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leases'] }),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">{t('dhcp.title')}</h1>

      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4">
        <h2 className="text-sm font-medium mb-3">{t('dhcp.leases')}</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-sentinel-muted border-b border-sentinel-border">
            <th className="text-left py-2">{t('dhcp.ip')}</th>
            <th className="text-left py-2">{t('dhcp.mac')}</th>
            <th className="text-left py-2">{t('dhcp.hostname')}</th>
            <th className="text-left py-2">{t('dhcp.expires')}</th>
            <th />
          </tr></thead>
          <tbody>
            {(leases as { ip: string; mac: string; hostname: string; expires: string }[]).map((l) => (
              <tr key={l.ip} className="border-b border-sentinel-border last:border-0">
                <td className="py-2 font-mono">{l.ip}</td>
                <td className="py-2 font-mono text-xs">{l.mac}</td>
                <td className="py-2">{l.hostname || '—'}</td>
                <td className="py-2 text-xs text-sentinel-muted">{l.expires || '—'}</td>
                <td className="py-2">
                  <button onClick={() => deleteMutation.mutate(l.mac)} className="text-sentinel-muted hover:text-sentinel-danger">
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
            {leases.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-sentinel-muted text-xs">—</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4">
        <h2 className="text-sm font-medium mb-3">{t('dhcp.add_static')}</h2>
        <div className="grid grid-cols-3 gap-2">
          {(['mac', 'ip', 'hostname'] as const).map((field) => (
            <input key={field} placeholder={t(`dhcp.${field}`)} value={form[field]}
              onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
              className="bg-sentinel-bg border border-sentinel-border rounded px-3 py-2 text-sm outline-none focus:border-sentinel-primary"
            />
          ))}
        </div>
        <button
          onClick={() => addMutation.mutate(form)}
          disabled={!form.mac || !form.ip}
          className="mt-3 bg-sentinel-primary hover:bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {t('common.add')}
        </button>
      </div>
    </div>
  )
}
