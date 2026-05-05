import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Zap } from 'lucide-react'
import { api } from '../lib/api'
import StatusBadge from '../components/common/StatusBadge'

const QUICKSTART = [
  { name: 'Web Server', protocol: 'tcp', external_port: 80,    internal_port: 80,   icon: '🌐' },
  { name: 'Web Server HTTPS', protocol: 'tcp', external_port: 443, internal_port: 443, icon: '🔒' },
  { name: 'RDP',        protocol: 'tcp', external_port: 3389,  internal_port: 3389, icon: '🖥️' },
  { name: 'Minecraft',  protocol: 'tcp', external_port: 25565, internal_port: 25565, icon: '⛏️' },
]

interface PortForward {
  name: string; protocol: string; external_port: number
  internal_ip: string; internal_port: number; enabled: boolean
}

const emptyFwd = (): Partial<PortForward> => ({
  name: '', protocol: 'tcp', external_port: 80, internal_ip: '', internal_port: 80, enabled: true
})

export default function NAT() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editIdx, setEditIdx]     = useState<number | null>(null)
  const [form, setForm]           = useState<Partial<PortForward>>(emptyFwd())

  const { data: masqData } = useQuery({ queryKey: ['masquerade'], queryFn: () => api.get('/nat/masquerade').then(r => r.data) })
  const { data: forwards = [] } = useQuery({ queryKey: ['forwards'], queryFn: () => api.get('/nat/forwards').then(r => r.data) })
  const { data: leases = [] }   = useQuery({ queryKey: ['leases'],   queryFn: () => api.get('/dhcp/leases').then(r => r.data) })

  const addMutation = useMutation({
    mutationFn: (data: PortForward) => api.post('/nat/forwards', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['forwards'] }); setShowModal(false); setForm(emptyFwd()) },
  })
  const updateMutation = useMutation({
    mutationFn: ({ idx, data }: { idx: number; data: PortForward }) => api.put(`/nat/forwards/${idx}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['forwards'] }); setShowModal(false); setEditIdx(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: (idx: number) => api.delete(`/nat/forwards/${idx}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forwards'] }),
  })

  const openAdd = (preset?: Partial<PortForward>) => {
    setForm({ ...emptyFwd(), ...preset })
    setEditIdx(null)
    setShowModal(true)
  }
  const openEdit = (idx: number) => {
    setForm({ ...(forwards as PortForward[])[idx] })
    setEditIdx(idx)
    setShowModal(true)
  }
  const handleSubmit = () => {
    const data = form as PortForward
    if (editIdx !== null) updateMutation.mutate({ idx: editIdx, data })
    else addMutation.mutate(data)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">{t('nat.title')}</h1>

      {/* Masquerade banner */}
      <div className="rounded-xl border p-4 flex items-center gap-4" style={{
        background:   masqData?.enabled ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
        borderColor:  masqData?.enabled ? 'rgba(16,185,129,0.3)'  : 'rgba(239,68,68,0.3)',
      }}>
        <StatusBadge
          variant={masqData?.enabled ? 'active' : 'inactive'}
          label={masqData?.enabled ? t('nat.masquerade_active') : t('nat.masquerade_inactive')}
        />
        {masqData?.enabled && (
          <p className="text-sm text-sentinel-muted">
            {t('nat.masquerade_via', { subnet: masqData.lan_subnet, interface: masqData.wan_interface, ip: masqData.public_ip })}
          </p>
        )}
      </div>

      {/* Quickstart templates */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4">
        <h2 className="text-sm font-medium mb-3 flex items-center gap-2"><Zap size={14} />{t('nat.quickstart')}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {QUICKSTART.map((qs) => (
            <button
              key={qs.name}
              onClick={() => openAdd({ name: qs.name, protocol: qs.protocol, external_port: qs.external_port, internal_port: qs.internal_port })}
              className="flex flex-col items-center gap-1 p-3 rounded-lg border border-sentinel-border hover:border-sentinel-primary hover:bg-sentinel-primary/5 transition-colors text-sm"
            >
              <span className="text-xl">{qs.icon}</span>
              <span className="text-xs text-sentinel-muted">{qs.name}</span>
              <span className="text-xs font-mono text-sentinel-primary">:{qs.external_port}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Port forwards table */}
      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium">{t('nat.port_forwards')}</h2>
          <button
            onClick={() => openAdd()}
            className="flex items-center gap-1 text-xs bg-sentinel-primary hover:bg-blue-600 text-white rounded px-3 py-1.5 transition-colors"
          >
            <Plus size={12} /> {t('nat.add_forward')}
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-sentinel-muted border-b border-sentinel-border">
              <th className="text-left py-2">{t('nat.name')}</th>
              <th className="text-left py-2">{t('nat.protocol')}</th>
              <th className="text-left py-2">{t('nat.ext_port')}</th>
              <th className="text-left py-2">{t('nat.int_target')}</th>
              <th className="text-left py-2">{t('nat.status')}</th>
              <th className="text-left py-2">{t('nat.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {(forwards as PortForward[]).map((fwd, i) => (
              <tr key={i} className="border-b border-sentinel-border last:border-0">
                <td className="py-2">{fwd.name}</td>
                <td className="py-2 font-mono uppercase text-xs">{fwd.protocol}</td>
                <td className="py-2 font-mono">{fwd.external_port}</td>
                <td className="py-2 font-mono">{fwd.internal_ip}:{fwd.internal_port}</td>
                <td className="py-2"><StatusBadge variant={fwd.enabled ? 'active' : 'inactive'} label={fwd.enabled ? t('common.enabled') : t('common.disabled')} /></td>
                <td className="py-2">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(i)} className="text-sentinel-muted hover:text-sentinel-text"><Pencil size={12} /></button>
                    <button onClick={() => { if (confirm(t('common.confirm_delete'))) deleteMutation.mutate(i) }} className="text-sentinel-muted hover:text-sentinel-danger"><Trash2 size={12} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {(forwards as PortForward[]).length === 0 && (
              <tr><td colSpan={6} className="py-4 text-center text-sentinel-muted text-xs">—</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 w-full max-w-md space-y-4">
            <h2 className="font-semibold">{editIdx !== null ? t('common.edit') : t('nat.add_forward')}</h2>
            {/* datalist provides DHCP lease IPs as autocomplete suggestions */}
            <datalist id="lease-ips">
              {(leases as { ip: string; hostname: string }[]).map((l) => (
                <option key={l.ip} value={l.ip} />
              ))}
            </datalist>
            {([
              { label: t('nat.name'),     key: 'name',          type: 'text'   },
              { label: t('nat.ext_port'), key: 'external_port', type: 'number' },
              { label: t('nat.int_target').split(':')[0], key: 'internal_ip', type: 'text' },
              { label: 'Internal Port',  key: 'internal_port', type: 'number' },
            ] as const).map(({ label, key, type }) => (
              <div key={key}>
                <label className="block text-xs text-sentinel-muted mb-1">{label}</label>
                <input
                  type={type}
                  list={key === 'internal_ip' ? 'lease-ips' : undefined}
                  value={String(form[key] ?? '')}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                  className="w-full bg-sentinel-bg border border-sentinel-border rounded px-3 py-2 text-sm outline-none focus:border-sentinel-primary"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs text-sentinel-muted mb-1">{t('nat.protocol')}</label>
              <select
                value={form.protocol ?? 'tcp'}
                onChange={(e) => setForm((f) => ({ ...f, protocol: e.target.value }))}
                className="w-full bg-sentinel-bg border border-sentinel-border rounded px-3 py-2 text-sm outline-none"
              >
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
                <option value="both">TCP + UDP</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowModal(false)} className="text-sm text-sentinel-muted hover:text-sentinel-text px-4 py-2">{t('common.cancel')}</button>
              <button onClick={handleSubmit} className="bg-sentinel-primary hover:bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium transition-colors">{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
