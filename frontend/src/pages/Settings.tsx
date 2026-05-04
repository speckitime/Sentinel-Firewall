import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../store/useStore'

export default function Settings() {
  const { t, i18n } = useTranslation()
  const setLanguage = useStore((s) => s.setLanguage)
  const [saved, setSaved] = useState(false)

  const handleLangChange = (lang: 'de' | 'en') => {
    i18n.changeLanguage(lang)
    setLanguage(lang)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">{t('settings.title')}</h1>

      <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-4 space-y-4">
        <h2 className="text-sm font-medium">{t('settings.language')}</h2>
        <div className="flex gap-2">
          {(['de', 'en'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => handleLangChange(lang)}
              className={`px-4 py-2 rounded text-sm font-medium border transition-colors ${
                i18n.language === lang
                  ? 'bg-sentinel-primary border-sentinel-primary text-white'
                  : 'border-sentinel-border text-sentinel-muted hover:border-sentinel-primary'
              }`}
            >
              {lang === 'de' ? 'Deutsch' : 'English'}
            </button>
          ))}
        </div>
        {saved && <p className="text-xs text-sentinel-success">{t('settings.save_success')}</p>}
      </div>
    </div>
  )
}
