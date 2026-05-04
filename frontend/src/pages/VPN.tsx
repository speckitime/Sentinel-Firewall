import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, QrCode } from 'lucide-react'
import { api } from '../lib/api'

export default function VPN() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [peerName, setPeerName] = useState('')
  const [qrData, setQrData]     = useState<{ key: string; qr: string } | null>(null)

  const { data: status } = useQuery({ queryKey: ['vpn-status'], queryFn: () => api.get('/vpn/status').then(r => r.data) })
  const { data: peers = [] }  = useQuery({ queryKey: ['vpn-peers'],  queryFn: () => api.get('/vpn/peers').then(r => r.data) })

  const addMutation = useMutation({
    mutationFn: (name: string) => api.post('/vpn/peers', { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vpn-peers'] }); setPeerName('') },
  })
  const removeMutation = useMutation({
    mutationFn: (pk: string) => api.delete(`/vpn/peers/${pk}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vpn-peers'] }),
  })
  const showQr = async (pk: string) => {
    const { data } = await api.get(`/vpn/peers/${pk}/qr`)
    setQrData({ key: pk, qr: data.qr_ascii })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">{t('vpn.title')}</h1>

      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4">
        <p className="text-xs text-sentinel-muted">wg0 &mdash; {status?.up ? 'up' : 'down'}</p>
        <pre className="text-xs text-sentinel-muted mt-2 overflow-x-auto">{status?.raw}</pre>
      </div>

      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4">
        <h2 className="text-sm font-medium mb-3">{t('vpn.peers')}</h2>
        <div className="space-y-2">
          {(peers as { public_key: string; allowed_ips: string }[]).map((peer) => (
            <div key={peer.public_key} className="flex items-center justify-between py-2 border-b border-sentinel-border last:border-0">
              <div>
                <p className="font-mono text-xs">{peer.public_key.substring(0, 20)}…</p>
                <p className="text-xs text-sentinel-muted">{peer.allowed_ips}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => showQr(peer.public_key)} className="text-sentinel-muted hover:text-sentinel-primary"><QrCode size={14} /></button>
                <button onClick={() => removeMutation.mutate(peer.public_key)} className="text-sentinel-muted hover:text-sentinel-danger"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <input placeholder={t('vpn.peer_name')} value={peerName} onChange={(e) => setPeerName(e.target.value)}
            className="flex-1 bg-sentinel-bg border border-sentinel-border rounded px-3 py-2 text-sm outline-none focus:border-sentinel-primary" />
          <button onClick={() => addMutation.mutate(peerName)} disabled={!peerName}
            className="flex items-center gap-1 bg-sentinel-primary hover:bg-blue-600 text-white rounded px-3 py-2 text-sm transition-colors disabled:opacity-50">
            <Plus size={12} /> {t('vpn.add_peer')}
          </button>
        </div>
      </div>

      {qrData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setQrData(null)}>
          <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 max-w-lg w-full">
            <h2 className="font-semibold mb-4">{t('vpn.show_qr')}</h2>
            <pre className="text-xs overflow-x-auto">{qrData.qr}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
