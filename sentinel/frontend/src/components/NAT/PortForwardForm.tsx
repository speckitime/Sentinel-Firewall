import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { X } from 'lucide-react'
import api from '../../lib/api'

interface PortForwardFormProps {
  initial: Record<string, unknown> | null
  editIndex: number | null
  leases: Record<string, unknown>[]
  onClose: () => void
  onSaved: () => void
}

const DEFAULT: Record<string, unknown> = {
  name: '',
  description: '',
  protocol: 'tcp',
  external_port: '',
  internal_ip: '',
  internal_port: '',
  enabled: true,
}

export default function PortForwardForm({
  initial,
  editIndex,
  leases,
  onClose,
  onSaved,
}: PortForwardFormProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<Record<string, unknown>>({ ...DEFAULT, ...(initial ?? {}) })
  const [error, setError] = useState('')

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        external_port: Number(form.external_port),
        internal_port: Number(form.internal_port),
      }
      if (editIndex !== null) {
        return api.put(`/nat/port-forwards/${editIndex}`, payload)
      }
      return api.post('/nat/port-forwards', payload)
    },
    onSuccess: onSaved,
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? t('common.error'))
    },
  })

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }))

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">
            {editIndex !== null ? t('common.edit') : t('nat.add_rule')}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded text-sentinel-muted hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-sentinel-text mb-1">{t('common.name')}</label>
          <input
            type="text"
            value={String(form.name)}
            onChange={(e) => set('name', e.target.value)}
            className="input"
            placeholder="Webserver"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-sentinel-text mb-1">{t('common.protocol')}</label>
          <select value={String(form.protocol)} onChange={(e) => set('protocol', e.target.value)} className="select">
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
            <option value="both">TCP + UDP</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-sentinel-text mb-1">{t('nat.wan_port')}</label>
            <input
              type="number"
              min={1}
              max={65535}
              value={String(form.external_port)}
              onChange={(e) => set('external_port', e.target.value)}
              className="input"
              placeholder="443"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-sentinel-text mb-1">{t('nat.lan_port')}</label>
            <input
              type="number"
              min={1}
              max={65535}
              value={String(form.internal_port)}
              onChange={(e) => set('internal_port', e.target.value)}
              className="input"
              placeholder="443"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-sentinel-text mb-1">{t('nat.lan_ip')}</label>
          {leases.length > 0 && (
            <select
              className="select mb-2"
              onChange={(e) => { if (e.target.value) set('internal_ip', e.target.value) }}
            >
              <option value="">{t('nat.select_from_dhcp')}</option>
              {leases.map((lease, idx) => (
                <option key={idx} value={String(lease.ip)}>
                  {String(lease.hostname) || String(lease.mac)} ({String(lease.ip)})
                </option>
              ))}
            </select>
          )}
          <input
            type="text"
            value={String(form.internal_ip)}
            onChange={(e) => set('internal_ip', e.target.value)}
            className="input"
            placeholder={t('nat.internal_ip_placeholder')}
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => set('enabled', !form.enabled)}
            className={`w-10 h-6 rounded-full transition-colors relative ${
              form.enabled ? 'bg-sentinel-primary' : 'bg-sentinel-border'
            }`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
              form.enabled ? 'translate-x-5' : 'translate-x-1'
            }`} />
          </div>
          <span className="text-sm text-sentinel-text">{t('common.enabled')}</span>
        </label>

        {error && <p className="text-sentinel-danger text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button className="btn-ghost flex-1" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn-primary flex-1"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
