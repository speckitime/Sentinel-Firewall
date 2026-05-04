import clsx from 'clsx'

type Variant = 'active' | 'inactive' | 'warning' | 'critical' | 'unknown'

const STYLES: Record<Variant, string> = {
  active:   'bg-sentinel-success/10 text-sentinel-success border-sentinel-success/30',
  inactive: 'bg-sentinel-danger/10  text-sentinel-danger  border-sentinel-danger/30',
  warning:  'bg-sentinel-warning/10 text-sentinel-warning border-sentinel-warning/30',
  critical: 'bg-sentinel-danger/20  text-sentinel-danger  border-sentinel-danger/50',
  unknown:  'bg-sentinel-muted/10   text-sentinel-muted   border-sentinel-muted/30',
}

interface Props {
  variant: Variant
  label: string
}

export default function StatusBadge({ variant, label }: Props) {
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border', STYLES[variant])}>
      <span className={clsx('w-1.5 h-1.5 rounded-full mr-1.5',
        variant === 'active'   ? 'bg-sentinel-success' :
        variant === 'inactive' ? 'bg-sentinel-danger'  :
        variant === 'warning'  ? 'bg-sentinel-warning' :
        variant === 'critical' ? 'bg-sentinel-danger'  : 'bg-sentinel-muted'
      )} />
      {label}
    </span>
  )
}
