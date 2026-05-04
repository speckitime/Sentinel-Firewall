import React from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../../store/useStore'

export default function LanguageSwitch() {
  const { i18n } = useTranslation()
  const { language, setLanguage } = useStore()

  const toggle = () => {
    const next = language === 'de' ? 'en' : 'de'
    setLanguage(next)
    i18n.changeLanguage(next)
    localStorage.setItem('sentinel-language', next)
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 px-3 py-2 w-full rounded-lg text-sm text-sentinel-muted hover:text-sentinel-text hover:bg-sentinel-surface transition-colors"
      title="Switch language"
    >
      <span className="text-base">{language === 'de' ? '🇩🇪' : '🇬🇧'}</span>
      <span>{language === 'de' ? 'Deutsch' : 'English'}</span>
    </button>
  )
}
