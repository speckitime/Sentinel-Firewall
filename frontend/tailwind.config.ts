import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'sentinel-bg':      '#0F172A',
        'sentinel-surface': '#1E293B',
        'sentinel-border':  '#334155',
        'sentinel-primary': '#3B82F6',
        'sentinel-success': '#10B981',
        'sentinel-warning': '#F59E0B',
        'sentinel-danger':  '#EF4444',
        'sentinel-text':    '#F1F5F9',
        'sentinel-muted':   '#94A3B8',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shake': 'shake 0.5s ease-in-out',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
