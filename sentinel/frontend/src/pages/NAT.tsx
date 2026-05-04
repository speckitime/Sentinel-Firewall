import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Edit2, ArrowRight, Globe, Server, Monitor, Gamepad2 } from 'lucide-react'
import api from '../lib/api'
import StatusBadge from '../components/common/StatusBadge'
import PortForwardForm from '../components/NAT/PortForwardForm'

const QUICKSTART_TEMPLATES = [
  { key: 'qs_webserver', icon: Globe, name: 'Web Server', protocol: 'tcp', ext: 80, int: 80 },
  { key: 'qs_rdp', icon: Monitor, name: 'Remote Desktop', protocol: 'tcp', ext: 3389, int: 3389 },
  { key: 'qs_minecraft', icon: Gamepad2, name: 'Minecraft', protocol: 'tcp', ext: 25565, int: 25565 },
  { key: 'qs_custom', icon: Server, name: 'Custom', protocol: 'tcp', ext: 8080, int: 8080 },
]

export default function NAT() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [editData, setEditData] = useState<Record<string, unknown> | null>(null)

  const { data: masqData } = useQuery({
    queryKey: ['nat-masquerade'],
    queryFn: () => api.get('/nat/masquerade').then((r) => r.data),
  })

  const { data: forwardsData, isLoading } = useQuery({
    queryKey: ['nat-port-forwards'],
    queryFn: () => api.get('/nat/port-forwards').then((r) => r.data),
    refetchInterval: 10_000,
  })

  const { data: leasesData } = useQuery({
    queryKey: ['dhcp-leases'],
    queryFn: () => api.get('/dhcp/leases').then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (index: number) => api.delete(`/nat/port-forwards/${index}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nat-port-forwards'] }),
  })

  const forwards: Record<string, unknown>[] = forwardsData?.port_forwards ?? []
  const leases: Record<string, unknown>[] = leasesData?.leases ?? []

  const openEdit = (idx: number) => {
    setEditIndex(idx)
    setEditData(forwards[idx])
    setShowForm(true)
  }

  const handleQuickstart = (template: typeof QUICKSTART_TEMPLATES[0]) => {
    setEditIndex(null)
    setEditData({
      name: template.name,
      protocol: template.protocol,
      external_port: template.ext,
      internal_port: template.int,
      internal_ip: '',
      enabled: true,
    })
    setShowForm(true)
  }

  return (
    <div className="space-y-6">
      {/* Masquerade status banner */}
      <div className="rounded-xl border p-4 flex items-center gap-4"
           style={{
             background: masqData?.enabled ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
             borderColor: masqData?.enabled ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
           }}>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge
              variant={masqData?.enabled ? 'active' : 'inactive'}
              label={masqData?.enabled ? t('nat.masquerade_active') : t('nat.masquerade_inactive')}
            />
          </div>
          {masqData?.enabled && (
            <p className="text-sm text-sentinel-muted">
              {t('nat.masquerade_via', {
                subnet: masqData.lan_subnet,
                interface: masqData.wan_interface,
                ip: masqData.public_ip,
              })}
            </p>
          )}
        </div>
        <ArrowRight size={20} className={masqData?.enabled ? 'text-sentinel-success' : 'text-sentinel-muted'} />
      </div>

      {/* Quick start templates */}
      <div>
        <h2 className="text-sm font-semibold text-sentinel-text mb-3">{t('nat.quickstart')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {QUICKSTART_TEMPLATES.map((tpl) => (
            <button
              key={tpl.key}
              onClick={() => handleQuickstart(tpl)}
              className="card text-left hover:border-sentinel-primary transition-colors cursor-pointer p-4"
            >
              <tpl.icon size={20} className="text-sentinel-primary mb-2" />
              <div className="text-sm font-medium text-white">{t(`nat.${tpl.key}`)}</div>
              <div className="text-xs text-sentinel-muted mt-0.5">:{tpl.ext}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Port forwarding table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-sentinel-text">{t('nat.port_forwards')}</h2>
          <button
            className="btn-primary flex items-center gap-2 text-sm"
            onClick={() => { setEditIndex(null); setEditData(null); setShowForm(true) }}
          >
            <Plus size={16} />
            {t('nat.add_rule')}
          </button>
        </div>

        {isLoading ? (
          <p className="text-sentinel-muted text-sm">{t('common.loading')}</p>
        ) : forwards.length === 0 ? (
          <p className="text-sentinel-muted text-sm">{t('nat.no_rules')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-sentinel-muted border-b border-sentinel-border text-left">
                  <th className="pb-2 pr-4 font-medium">{t('common.name')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('common.protocol')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('nat.wan_port')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('nat.lan_ip')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('nat.lan_port')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('common.status')}</th>
                  <th className="pb-2 font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {forwards.map((pf, idx) => (
                  <tr key={idx} className="table-row">
                    <td className="py-3 pr-4 text-white font-medium">{String(pf.name)}</td>
                    <td className="py-3 pr-4 text-sentinel-muted uppercase text-xs">{String(pf.protocol)}</td>
                    <td className="py-3 pr-4 text-white">{String(pf.external_port)}</td>
                    <td className="py-3 pr-4 text-sentinel-text font-mono text-xs">{String(pf.internal_ip)}</td>
                    <td className="py-3 pr-4 text-white">{String(pf.internal_port)}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge
                        variant={pf.enabled ? 'active' : 'inactive'}
                        label={pf.enabled ? t('common.active') : t('common.inactive')}
                      />
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(idx)}
                          className="p-1.5 rounded text-sentinel-muted hover:text-white hover:bg-sentinel-border transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(idx)}
                          className="p-1.5 rounded text-sentinel-muted hover:text-sentinel-danger hover:bg-sentinel-border transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <PortForwardForm
          initial={editData}
          editIndex={editIndex}
          leases={leases}
          onClose={() => { setShowForm(false); setEditData(null); setEditIndex(null) }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['nat-port-forwards'] })
            setShowForm(false)
          }}
        />
      )}
    </div>
  )
}
