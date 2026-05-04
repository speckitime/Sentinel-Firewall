import { useTranslation } from 'react-i18next'
import { useStore } from '../../store/useStore'

export default function LanguageSwitch() {
  const { i18n } = useTranslation()
  const setLanguage = useStore((s) => s.setLanguage)

  const toggle = () => {
    const next = i18n.language === 'de' ? 'en' : 'de'
    i18n.changeLanguage(next)
    setLanguage(next as 'de' | 'en')
  }

  return (
    <button
      onClick={toggle}
      className="text-xs font-mono text-sentinel-muted hover:text-sentinel-text transition-colors px-2 py-1 rounded border border-sentinel-border"
    >
      {i18n.language === 'de' ? 'DE' : 'EN'}
    </button>
  )
}
