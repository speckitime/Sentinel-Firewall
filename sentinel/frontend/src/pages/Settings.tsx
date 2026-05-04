import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../store/useStore'
import i18n from '../i18n/config'

export default function Settings() {
  const { t } = useTranslation()
  const { language, setLanguage } = useStore()
  const [saved, setSaved] = useState(false)

  const handleLanguageChange = (lang: 'de' | 'en') => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
    localStorage.setItem('sentinel-language', lang)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* General */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-sentinel-text">{t('settings.general')}</h2>
        <div>
          <label className="block text-sm font-medium text-sentinel-text mb-2">{t('settings.language')}</label>
          <div className="flex gap-3">
            <button
              onClick={() => handleLanguageChange('de')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                language === 'de' ? 'bg-sentinel-primary text-white' : 'bg-sentinel-bg border border-sentinel-border text-sentinel-muted hover:text-white'
              }`}
            >
              🇩🇪 Deutsch
            </button>
            <button
              onClick={() => handleLanguageChange('en')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                language === 'en' ? 'bg-sentinel-primary text-white' : 'bg-sentinel-bg border border-sentinel-border text-sentinel-muted hover:text-white'
              }`}
            >
              🇬🇧 English
            </button>
          </div>
          {saved && <p className="text-sentinel-success text-sm mt-2">{t('settings.save_settings')} ✓</p>}
        </div>
      </div>

      {/* Notifications placeholder */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-sentinel-text">{t('settings.notifications')}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-sentinel-text mb-1">{t('settings.telegram_token')}</label>
            <input type="password" className="input" placeholder="bot:token" />
          </div>
          <div>
            <label className="block text-sm font-medium text-sentinel-text mb-1">{t('settings.telegram_chat')}</label>
            <input type="text" className="input" placeholder="-100123456789" />
          </div>
          <button className="btn-primary">{t('settings.save_settings')}</button>
        </div>
      </div>
    </div>
  )
}
