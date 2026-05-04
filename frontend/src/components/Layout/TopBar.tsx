import { useTranslation } from 'react-i18next'
import { LogOut } from 'lucide-react'
import { useStore } from '../../store/useStore'
import LanguageSwitch from '../common/LanguageSwitch'
import { useNavigate } from 'react-router-dom'

export default function TopBar() {
  const { t } = useTranslation()
  const logout = useStore((s) => s.logout)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="h-12 flex items-center justify-end gap-4 px-6 border-b border-sentinel-border bg-sentinel-surface">
      <LanguageSwitch />
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 text-sm text-sentinel-muted hover:text-sentinel-danger transition-colors"
      >
        <LogOut size={14} />
        Logout
      </button>
    </header>
  )
}
