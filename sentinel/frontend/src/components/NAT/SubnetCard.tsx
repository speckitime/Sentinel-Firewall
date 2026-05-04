import React from 'react'
import { Network } from 'lucide-react'
import StatusBadge from '../common/StatusBadge'

interface SubnetCardProps {
  name: string
  network: string
  gateway: string
  interface_name: string
  dhcp_enabled: boolean
  lease_count?: number
}

export default function SubnetCard({
  name,
  network,
  gateway,
  interface_name,
  dhcp_enabled,
  lease_count = 0,
}: SubnetCardProps) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sentinel-primary/20 flex items-center justify-center">
            <Network size={20} className="text-sentinel-primary" />
          </div>
          <div>
            <div className="font-semibold text-white">{name}</div>
            <div className="text-sentinel-muted text-xs font-mono">{network}</div>
          </div>
        </div>
        <StatusBadge variant="active" label="Active" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div>
          <div className="text-sentinel-muted">Gateway</div>
          <div className="text-white font-mono">{gateway}</div>
        </div>
        <div>
          <div className="text-sentinel-muted">Interface</div>
          <div className="text-white">{interface_name}</div>
        </div>
        <div>
          <div className="text-sentinel-muted">DHCP Leases</div>
          <div className="text-white">{dhcp_enabled ? lease_count : 'Disabled'}</div>
        </div>
      </div>
    </div>
  )
}
