import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'
import { useStore } from '../store/useStore'
import ShieldLogo from '../components/Shield/ShieldLogo'

export default function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setToken, setupComplete } = useStore()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('username', username)
      params.append('password', password)
      const res = await api.post('/system/auth/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      setToken(res.data.access_token)
      navigate(setupComplete ? '/' : '/setup')
    } catch {
      setError(t('login.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-sentinel-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <ShieldLogo state="active" size="xl" className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">Sentinel</h1>
          <p className="text-sentinel-muted text-sm mt-1">{t('login.title')}</p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-sentinel-text mb-1">
              {t('login.username')}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-sentinel-text mb-1">
              {t('login.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sentinel-danger text-sm">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? t('common.loading') : t('login.sign_in')}
          </button>
        </form>
      </div>
    </div>
  )
}
