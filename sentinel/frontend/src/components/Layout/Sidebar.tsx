import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Shield,
  ArrowLeftRight,
  Network,
  Globe,
  Lock,
  AlertTriangle,
  Settings,
  LogOut,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import ShieldLogo from '../Shield/ShieldLogo'
import LanguageSwitch from '../common/LanguageSwitch'

const navItems = [
  { path: '/', icon: LayoutDashboard, key: 'dashboard' },
  { path: '/firewall', icon: Shield, key: 'firewall' },
  { path: '/nat', icon: ArrowLeftRight, key: 'nat' },
  { path: '/dhcp', icon: Network, key: 'dhcp' },
  { path: '/dns', icon: Globe, key: 'dns' },
  { path: '/vpn', icon: Lock, key: 'vpn' },
  { path: '/threats', icon: AlertTriangle, key: 'threats' },
  { path: '/settings', icon: Settings, key: 'settings' },
]

export default function Sidebar() {
  const { t } = useTranslation()
  const { logout } = useStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="w-64 bg-sentinel-bg border-r border-sentinel-border flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sentinel-border">
        <ShieldLogo state="active" size="md" />
        <div>
          <div className="font-bold text-white text-lg leading-none">Sentinel</div>
          <div className="text-sentinel-success text-xs mt-0.5">{t('status.protected')}</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ path, icon: Icon, key }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-sentinel-primary text-white'
                  : 'text-sentinel-muted hover:text-sentinel-text hover:bg-sentinel-surface'
              }`
            }
          >
            <Icon size={18} />
            {t(`nav.${key}`)}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-sentinel-border space-y-2">
        <LanguageSwitch />
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-sentinel-muted hover:text-sentinel-danger hover:bg-sentinel-surface transition-colors duration-150"
        >
          <LogOut size={18} />
          {t('nav.logout')}
        </button>
      </div>
    </aside>
  )
}
