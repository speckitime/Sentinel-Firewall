import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { useStore } from '../store/useStore'
import ShieldLogo from '../components/Shield/ShieldLogo'

export default function Login() {
  const { t } = useTranslation()
  const navigate  = useNavigate()
  const setToken  = useStore((s) => s.setToken)
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const form = new URLSearchParams()
      form.append('username', username)
      form.append('password', password)
      const { data } = await api.post('/system/auth/login', form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      setToken(data.access_token)
      navigate('/')
    } catch {
      setError(t('login.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-sentinel-bg flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-3">
          <ShieldLogo state="idle" size="lg" />
          <h1 className="text-2xl font-bold text-sentinel-text">{t('login.title')}</h1>
        </div>
        <form onSubmit={handleSubmit} className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs text-sentinel-muted mb-1">{t('login.username')}</label>
            <input
              type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-sentinel-bg border border-sentinel-border rounded px-3 py-2 text-sm text-sentinel-text focus:border-sentinel-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-sentinel-muted mb-1">{t('login.password')}</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-sentinel-bg border border-sentinel-border rounded px-3 py-2 text-sm text-sentinel-text focus:border-sentinel-primary outline-none"
            />
          </div>
          {error && <p className="text-sentinel-danger text-xs">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="bg-sentinel-primary hover:bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('login.submit')}
          </button>
        </form>
      </div>
    </div>
  )
}
