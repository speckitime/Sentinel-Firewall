import React from 'react'

type ShieldState = 'idle' | 'active' | 'alert' | 'blocked'
type ShieldSize = 'sm' | 'md' | 'lg' | 'xl'

const SIZE_MAP: Record<ShieldSize, number> = {
  sm: 24,
  md: 32,
  lg: 48,
  xl: 96,
}

const COLOR_MAP: Record<ShieldState, { fill: string; stroke: string }> = {
  idle:    { fill: '#3B82F6', stroke: '#2563EB' },
  active:  { fill: '#10B981', stroke: '#059669' },
  alert:   { fill: '#F59E0B', stroke: '#D97706' },
  blocked: { fill: '#EF4444', stroke: '#DC2626' },
}

const ANIMATION_MAP: Record<ShieldState, string> = {
  idle:    '',
  active:  'animate-pulse',
  alert:   'animate-shake',
  blocked: '',
}

interface ShieldLogoProps {
  state?: ShieldState
  size?: ShieldSize
  className?: string
}

export default function ShieldLogo({
  state = 'idle',
  size = 'md',
  className = '',
}: ShieldLogoProps) {
  const px = SIZE_MAP[size]
  const { fill, stroke } = COLOR_MAP[state]
  const animation = ANIMATION_MAP[state]

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${animation} ${className}`}
    >
      <path
        d="M16 2L4 7V16C4 22.6 9.4 28.6 16 30C22.6 28.6 28 22.6 28 16V7L16 2Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fill="white"
        fontSize="13"
        fontWeight="700"
        fontFamily="Inter, system-ui, sans-serif"
      >
        S
      </text>
    </svg>
  )
}
