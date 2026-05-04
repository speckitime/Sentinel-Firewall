import React from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

export default function DHCP() {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['dhcp-leases'],
    queryFn: () => api.get('/dhcp/leases').then((r) => r.data),
    refetchInterval: 15_000,
  })

  const leases: Record<string, unknown>[] = data?.leases ?? []

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-sm font-semibold text-sentinel-text mb-4">{t('dhcp.leases')}</h2>
        {isLoading ? (
          <p className="text-sentinel-muted text-sm">{t('common.loading')}</p>
        ) : leases.length === 0 ? (
          <p className="text-sentinel-muted text-sm">{t('dhcp.no_leases')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-sentinel-muted border-b border-sentinel-border text-left">
                  <th className="pb-2 pr-4 font-medium">{t('dhcp.ip')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('dhcp.mac')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('dhcp.hostname')}</th>
                  <th className="pb-2 font-medium">{t('dhcp.expires')}</th>
                </tr>
              </thead>
              <tbody>
                {leases.map((lease, idx) => (
                  <tr key={idx} className="table-row">
                    <td className="py-3 pr-4 font-mono text-xs text-white">{String(lease.ip)}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-sentinel-muted">{String(lease.mac)}</td>
                    <td className="py-3 pr-4 text-sentinel-text">{String(lease.hostname) || '—'}</td>
                    <td className="py-3 text-sentinel-muted text-xs">
                      {lease.expires
                        ? new Date(Number(lease.expires) * 1000).toLocaleString('de-DE')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
