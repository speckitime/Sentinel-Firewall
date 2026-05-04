import clsx from 'clsx'

type ShieldState = 'idle' | 'active' | 'alert' | 'blocked'
type ShieldSize  = 'sm' | 'md' | 'lg' | 'xl'

const SIZE_MAP: Record<ShieldSize, number> = { sm: 28, md: 40, lg: 64, xl: 96 }

const COLOR_MAP: Record<ShieldState, string> = {
  idle:    '#3B82F6',
  active:  '#10B981',
  alert:   '#F59E0B',
  blocked: '#EF4444',
}

const ANIM_MAP: Record<ShieldState, string> = {
  idle:    '',
  active:  'animate-pulse-slow',
  alert:   'animate-shake',
  blocked: '',
}

interface Props {
  state?: ShieldState
  size?:  ShieldSize
}

export default function ShieldLogo({ state = 'idle', size = 'md' }: Props) {
  const px    = SIZE_MAP[size]
  const color = COLOR_MAP[state]

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      className={clsx('transition-all duration-300', ANIM_MAP[state])}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M50 5 L90 20 L90 50 C90 72 72 88 50 95 C28 88 10 72 10 50 L10 20 Z"
        fill={color}
        fillOpacity="0.15"
        stroke={color}
        strokeWidth="3"
      />
      <text
        x="50"
        y="62"
        textAnchor="middle"
        fontSize="38"
        fontWeight="bold"
        fill={color}
        fontFamily="system-ui, sans-serif"
      >
        S
      </text>
    </svg>
  )
}
