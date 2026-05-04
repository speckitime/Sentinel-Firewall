import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import api from '../lib/api'
import StatusBadge from '../components/common/StatusBadge'

export default function VPN() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [newPeerName, setNewPeerName] = useState('')
  const [qrPeer, setQrPeer] = useState<{ name: string; config: string } | null>(null)

  const { data: statusData } = useQuery({
    queryKey: ['vpn-status'],
    queryFn: () => api.get('/vpn/status').then((r) => r.data),
    refetchInterval: 15_000,
  })

  const { data: peersData, isLoading } = useQuery({
    queryKey: ['vpn-peers'],
    queryFn: () => api.get('/vpn/peers').then((r) => r.data),
    refetchInterval: 15_000,
  })

  const addMutation = useMutation({
    mutationFn: (name: string) => api.post('/vpn/peers', { name }),
    onSuccess: async (res) => {
      queryClient.invalidateQueries({ queryKey: ['vpn-peers'] })
      const configRes = await api.get(`/vpn/peers/${res.data.peer.name}/config`)
      setQrPeer({ name: res.data.peer.name, config: configRes.data.config })
      setNewPeerName('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.delete(`/vpn/peers/${name}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vpn-peers'] }),
  })

  const peers: Record<string, unknown>[] = peersData?.peers ?? []

  return (
    <div className="space-y-6">
      {/* Server status */}
      <div className="card">
        <h2 className="text-sm font-semibold text-sentinel-text mb-3">{t('vpn.server_status')}</h2>
        <div className="flex items-center gap-4">
          <StatusBadge
            variant={statusData?.active ? 'active' : 'inactive'}
            label={statusData?.active ? t('common.active') : t('common.inactive')}
          />
          {statusData?.listen_port && (
            <span className="text-sentinel-muted text-sm">Port: {String(statusData.listen_port)}/UDP</span>
          )}
          {statusData?.peer_count !== undefined && (
            <span className="text-sentinel-muted text-sm">{String(statusData.peer_count)} {t('vpn.peers')}</span>
          )}
        </div>
      </div>

      {/* Add peer */}
      <div className="card">
        <h2 className="text-sm font-semibold text-sentinel-text mb-3">{t('vpn.add_peer')}</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newPeerName}
            onChange={(e) => setNewPeerName(e.target.value)}
            placeholder={t('vpn.peer_name')}
            className="input flex-1"
          />
          <button
            className="btn-primary flex items-center gap-2"
            disabled={!newPeerName.trim() || addMutation.isPending}
            onClick={() => addMutation.mutate(newPeerName.trim())}
          >
            <Plus size={16} />
            {t('common.add')}
          </button>
        </div>
      </div>

      {/* Peers table */}
      <div className="card">
        <h2 className="text-sm font-semibold text-sentinel-text mb-4">{t('vpn.peers')}</h2>
        {isLoading ? (
          <p className="text-sentinel-muted text-sm">{t('common.loading')}</p>
        ) : peers.length === 0 ? (
          <p className="text-sentinel-muted text-sm">{t('vpn.no_peers')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-sentinel-muted border-b border-sentinel-border text-left">
                  <th className="pb-2 pr-4 font-medium">{t('vpn.public_key')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('vpn.allowed_ips')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('vpn.last_handshake')}</th>
                  <th className="pb-2 font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {peers.map((peer, idx) => (
                  <tr key={idx} className="table-row">
                    <td className="py-3 pr-4 font-mono text-xs text-sentinel-muted">
                      {String(peer.public_key).slice(0, 20)}...
                    </td>
                    <td className="py-3 pr-4 text-sentinel-text">{String(peer.allowed_ips)}</td>
                    <td className="py-3 pr-4 text-sentinel-muted text-xs">
                      {peer.last_handshake
                        ? new Date(Number(peer.last_handshake) * 1000).toLocaleString('de-DE')
                        : t('common.none')}
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => deleteMutation.mutate(String(peer.public_key))}
                        className="p-1.5 rounded text-sentinel-muted hover:text-sentinel-danger hover:bg-sentinel-border transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QR Code modal */}
      {qrPeer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="card max-w-sm w-full text-center space-y-4">
            <h3 className="font-semibold text-white">{qrPeer.name} — {t('vpn.show_qr')}</h3>
            <div className="bg-white p-4 rounded-lg inline-block">
              <QRCodeSVG value={qrPeer.config} size={200} />
            </div>
            <p className="text-xs text-sentinel-muted">Scan with WireGuard app</p>
            <button className="btn-primary w-full" onClick={() => setQrPeer(null)}>
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
