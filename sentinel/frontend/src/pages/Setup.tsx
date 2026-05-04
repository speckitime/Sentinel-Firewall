import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { useStore } from '../store/useStore'
import ShieldLogo from '../components/Shield/ShieldLogo'

const TOTAL_STEPS = 5

export default function Setup() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setSetupComplete } = useStore()
  const [step, setStep] = useState(1)
  const [config, setConfig] = useState({
    wan_interface: '',
    lan_interface: '',
    lan_subnet: '192.168.1.0/24',
    password: '',
    confirmPassword: '',
    enable_dhcp: true,
    enable_dns: true,
    enable_vpn: true,
    enable_ids: true,
  })
  const [error, setError] = useState('')

  const { data: interfacesData } = useQuery({
    queryKey: ['system-interfaces'],
    queryFn: () => api.get('/system/interfaces').then((r) => r.data),
  })

  const interfaces: Record<string, unknown>[] = interfacesData?.interfaces ?? []

  const validateStep = () => {
    if (step === 3) {
      if (config.password.length < 8) { setError(t('setup.password_too_short')); return false }
      if (config.password !== config.confirmPassword) { setError(t('setup.password_mismatch')); return false }
    }
    setError('')
    return true
  }

  const handleNext = () => {
    if (!validateStep()) return
    setStep((s) => Math.min(s + 1, TOTAL_STEPS))
  }

  const handleBack = () => setStep((s) => Math.max(s - 1, 1))

  const handleFinish = async () => {
    try {
      await api.post('/system/setup/complete', config)
      setSetupComplete(true)
      navigate('/')
    } catch {
      setError(t('common.error'))
    }
  }

  const stepLabels = [
    t('setup.step_welcome'),
    t('setup.step_network'),
    t('setup.step_account'),
    t('setup.step_services'),
    t('setup.step_complete'),
  ]

  return (
    <div className="min-h-screen bg-sentinel-bg flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-sentinel-muted mb-2">
            <span>{t('setup.step', { current: step, total: TOTAL_STEPS })}</span>
            <span>{stepLabels[step - 1]}</span>
          </div>
          <div className="w-full bg-sentinel-surface rounded-full h-1.5">
            <div
              className="bg-sentinel-primary h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        <div className="card">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="text-center space-y-4">
              <ShieldLogo state="active" size="xl" className="mx-auto" />
              <h1 className="text-2xl font-bold text-white">{t('setup.welcome_title')}</h1>
              <p className="text-sentinel-muted">{t('setup.welcome_subtitle')}</p>
            </div>
          )}

          {/* Step 2: Network */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-white">{t('setup.step_network')}</h2>
              <div>
                <label className="block text-sm font-medium text-sentinel-text mb-1">{t('setup.wan_interface')}</label>
                <select
                  value={config.wan_interface}
                  onChange={(e) => setConfig({ ...config, wan_interface: e.target.value })}
                  className="select"
                >
                  <option value="">{t('common.none')}</option>
                  {interfaces.map((iface) => (
                    <option key={String(iface.name)} value={String(iface.name)}>
                      {String(iface.name)} {iface.ipv4 ? `(${String(iface.ipv4)})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-sentinel-text mb-1">{t('setup.lan_interface')}</label>
                <select
                  value={config.lan_interface}
                  onChange={(e) => setConfig({ ...config, lan_interface: e.target.value })}
                  className="select"
                >
                  <option value="">{t('common.none')}</option>
                  {interfaces.map((iface) => (
                    <option key={String(iface.name)} value={String(iface.name)}>
                      {String(iface.name)} {iface.ipv4 ? `(${String(iface.ipv4)})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-sentinel-text mb-1">{t('setup.lan_subnet')}</label>
                <input
                  type="text"
                  value={config.lan_subnet}
                  onChange={(e) => setConfig({ ...config, lan_subnet: e.target.value })}
                  className="input"
                  placeholder="192.168.1.0/24"
                />
              </div>
            </div>
          )}

          {/* Step 3: Account */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-white">{t('setup.step_account')}</h2>
              <div>
                <label className="block text-sm font-medium text-sentinel-text mb-1">{t('setup.admin_password')}</label>
                <input
                  type="password"
                  value={config.password}
                  onChange={(e) => setConfig({ ...config, password: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-sentinel-text mb-1">{t('setup.confirm_password')}</label>
                <input
                  type="password"
                  value={config.confirmPassword}
                  onChange={(e) => setConfig({ ...config, confirmPassword: e.target.value })}
                  className="input"
                />
              </div>
              {/* Password strength */}
              <div className="h-1.5 w-full bg-sentinel-border rounded-full">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    config.password.length >= 12 ? 'bg-sentinel-success w-full'
                    : config.password.length >= 8 ? 'bg-sentinel-warning w-2/3'
                    : 'bg-sentinel-danger w-1/3'
                  }`}
                />
              </div>
            </div>
          )}

          {/* Step 4: Services */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-white">{t('setup.step_services')}</h2>
              {[
                { key: 'enable_dhcp', label: t('setup.enable_dhcp') },
                { key: 'enable_dns', label: t('setup.enable_dns') },
                { key: 'enable_vpn', label: t('setup.enable_vpn') },
                { key: 'enable_ids', label: t('setup.enable_ids') },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setConfig({ ...config, [key]: !config[key as keyof typeof config] })}
                    className={`w-10 h-6 rounded-full transition-colors ${
                      config[key as keyof typeof config] ? 'bg-sentinel-primary' : 'bg-sentinel-border'
                    } relative`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      config[key as keyof typeof config] ? 'translate-x-5' : 'translate-x-1'
                    }`} />
                  </div>
                  <span className="text-sentinel-text text-sm">{label}</span>
                </label>
              ))}
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 5 && (
            <div className="text-center space-y-4">
              <ShieldLogo state="active" size="xl" className="mx-auto" />
              <h2 className="text-xl font-bold text-white">{t('setup.setup_complete_title')}</h2>
              <p className="text-sentinel-muted">{t('setup.setup_complete_subtitle')}</p>
            </div>
          )}

          {error && <p className="text-sentinel-danger text-sm mt-3">{error}</p>}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-6 pt-4 border-t border-sentinel-border">
            <button
              className="btn-ghost"
              onClick={handleBack}
              disabled={step === 1}
            >
              {t('setup.back')}
            </button>
            {step < TOTAL_STEPS ? (
              <button className="btn-primary" onClick={handleNext}>
                {t('setup.next')}
              </button>
            ) : (
              <button className="btn-primary" onClick={handleFinish}>
                {t('setup.go_to_dashboard')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
