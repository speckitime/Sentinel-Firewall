import React from 'react'
import { AlertTriangle } from 'lucide-react'
import StatusBadge from './StatusBadge'

const SEVERITY_VARIANT: Record<number, 'blocked' | 'warning' | 'active'> = {
  1: 'blocked',
  2: 'warning',
  3: 'active',
}

const SEVERITY_LABEL: Record<number, string> = {
  1: 'High',
  2: 'Medium',
  3: 'Low',
}

interface ThreatCardProps {
  alert: Record<string, unknown>
}

export default function ThreatCard({ alert }: ThreatCardProps) {
  const severity = Number(alert.severity) || 3
  const confidence = Number(alert.confidence) || 0

  return (
    <div className="flex items-start gap-3 p-3 bg-sentinel-bg rounded-lg border border-sentinel-border">
      <AlertTriangle
        size={16}
        className={`mt-0.5 flex-shrink-0 ${
          severity === 1 ? 'text-sentinel-danger'
          : severity === 2 ? 'text-sentinel-warning'
          : 'text-sentinel-success'
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white text-xs font-medium truncate">
            {String(alert.signature)}
          </span>
          <StatusBadge
            variant={SEVERITY_VARIANT[severity]}
            label={SEVERITY_LABEL[severity]}
          />
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-sentinel-muted text-xs font-mono">{String(alert.src_ip)}</span>
          <span className="text-sentinel-muted text-xs">{confidence}% confidence</span>
        </div>
      </div>
      <span className="text-sentinel-muted text-xs flex-shrink-0">
        {String(alert.timestamp).slice(11, 19)}
      </span>
    </div>
  )
}
