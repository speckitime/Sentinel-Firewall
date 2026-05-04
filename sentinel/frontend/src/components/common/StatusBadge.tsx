import React from 'react'

type BadgeVariant = 'active' | 'inactive' | 'blocked' | 'warning' | 'unknown'

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  active:   'bg-sentinel-success/20 text-sentinel-success',
  inactive: 'bg-sentinel-muted/20 text-sentinel-muted',
  blocked:  'bg-sentinel-danger/20 text-sentinel-danger',
  warning:  'bg-sentinel-warning/20 text-sentinel-warning',
  unknown:  'bg-sentinel-border/20 text-sentinel-muted',
}

interface StatusBadgeProps {
  variant: BadgeVariant
  label: string
  className?: string
}

export default function StatusBadge({ variant, label, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        VARIANT_CLASSES[variant]
      } ${className}`}
    >
      {label}
    </span>
  )
}
