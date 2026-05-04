import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, Shield, ArrowLeftRight, Network,
  Globe, Wifi, AlertTriangle, Settings,
} from 'lucide-react'
import ShieldLogo from '../Shield/ShieldLogo'
import clsx from 'clsx'

const NAV_ITEMS = [
  { to: '/',         icon: LayoutDashboard, key: 'dashboard' },
  { to: '/firewall', icon: Shield,          key: 'firewall'  },
  { to: '/nat',      icon: ArrowLeftRight,  key: 'nat'       },
  { to: '/dhcp',     icon: Network,         key: 'dhcp'      },
  { to: '/dns',      icon: Globe,           key: 'dns'       },
  { to: '/vpn',      icon: Wifi,            key: 'vpn'       },
  { to: '/threats',  icon: AlertTriangle,   key: 'threats'   },
  { to: '/settings', icon: Settings,        key: 'settings'  },
]

export default function Sidebar() {
  const { t } = useTranslation()

  return (
    <aside className="w-56 flex-shrink-0 bg-sentinel-surface border-r border-sentinel-border flex flex-col">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sentinel-border">
        <ShieldLogo state="active" size="sm" />
        <span className="font-bold text-sentinel-text tracking-wide">Sentinel</span>
      </div>
      <nav className="flex-1 py-4">
        {NAV_ITEMS.map(({ to, icon: Icon, key }) => (
          <NavLink
            key={key}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-sentinel-primary/10 text-sentinel-primary border-r-2 border-sentinel-primary'
                  : 'text-sentinel-muted hover:text-sentinel-text hover:bg-white/5'
              )
            }
          >
            <Icon size={16} />
            {t(`nav.${key}`)}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
