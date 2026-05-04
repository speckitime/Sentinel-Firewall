import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useStore } from '../store/useStore'
import ShieldLogo from '../components/Shield/ShieldLogo'

const TOTAL_STEPS = 5

export default function Setup() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setSetupComplete = useStore((s) => s.setSetupComplete)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    wan_interface: '', lan_interface: '', lan_subnet: '10.0.1.0/24',
    admin_password: '', confirm_password: '',
    enable_dhcp: true, enable_dns: true, enable_vpn: true, enable_ids: true,
  })

  const { data: interfaces = [] } = useQuery({
    queryKey: ['interfaces'],
    queryFn: () => api.get('/system/interfaces').then(r => r.data),
  })

  const finish = async () => {
    setLoading(true)
    try {
      await api.post('/system/setup/complete', {
        ...form,
        admin_password: form.admin_password,
      })
      setSetupComplete(true)
      navigate('/')
    } catch {
      // show error
    } finally {
      setLoading(false)
    }
  }

  const STEP_LABELS = [
    t('setup.step_welcome'), t('setup.step_network'),
    t('setup.step_account'), t('setup.step_services'), t('setup.step_complete'),
  ]

  return (
    <div className="min-h-screen bg-sentinel-bg flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-between mb-6">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                i + 1 < step  ? 'bg-sentinel-success border-sentinel-success text-white' :
                i + 1 === step ? 'border-sentinel-primary text-sentinel-primary' :
                'border-sentinel-border text-sentinel-muted'
              }`}>{i + 1 < step ? '✓' : i + 1}</div>
              <span className="text-xs text-sentinel-muted hidden sm:block">{label}</span>
            </div>
          ))}
        </div>
        <div className="h-1 bg-sentinel-border rounded mb-8">
          <div className="h-1 bg-sentinel-primary rounded transition-all" style={{ width: `${((step - 1) / (TOTAL_STEPS - 1)) * 100}%` }} />
        </div>

        <div className="bg-sentinel-surface border border-sentinel-border rounded-xl p-6">
          {step === 1 && (
            <div className="flex flex-col items-center gap-4 py-4">
              <ShieldLogo state="active" size="xl" />
              <h1 className="text-2xl font-bold">{t('setup.title')}</h1>
              <p className="text-sm text-sentinel-muted text-center">
                Sentinel schützt dein Netzwerk mit nftables, Suricata IDS, WireGuard VPN und mehr.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-semibold">{t('setup.step_network')}</h2>
              {(['wan_interface','lan_interface'] as const).map((field) => (
                <div key={field}>
                  <label className="block text-xs text-sentinel-muted mb-1">{t(`setup.${field}`)}</label>
                  <select value={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                    className="w-full bg-sentinel-bg border border-sentinel-border rounded px-3 py-2 text-sm outline-none">
                    <option value="">— {t('common.unknown')} —</option>
                    {(interfaces as { name: string }[]).map(({ name }) => <option key={name}>{name}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label className="block text-xs text-sentinel-muted mb-1">{t('setup.lan_subnet')}</label>
                <input value={form.lan_subnet} onChange={(e) => setForm((f) => ({ ...f, lan_subnet: e.target.value }))}
                  className="w-full bg-sentinel-bg border border-sentinel-border rounded px-3 py-2 text-sm outline-none focus:border-sentinel-primary" />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-semibold">{t('setup.step_account')}</h2>
              {(['admin_password','confirm_password'] as const).map((field) => (
                <div key={field}>
                  <label className="block text-xs text-sentinel-muted mb-1">{t(`setup.${field}`)}</label>
                  <input type="password" value={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                    className="w-full bg-sentinel-bg border border-sentinel-border rounded px-3 py-2 text-sm outline-none focus:border-sentinel-primary" />
                </div>
              ))}
              {form.admin_password && form.admin_password !== form.confirm_password && (
                <p className="text-xs text-sentinel-danger">Passwords do not match</p>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-semibold">{t('setup.step_services')}</h2>
              {(['enable_dhcp','enable_dns','enable_vpn','enable_ids'] as const).map((field) => (
                <label key={field} className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm">{t(`setup.${field}`)}</span>
                  <input type="checkbox" checked={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.checked }))}
                    className="w-4 h-4 accent-sentinel-primary" />
                </label>
              ))}
            </div>
          )}

          {step === 5 && (
            <div className="flex flex-col items-center gap-4 py-4">
              <ShieldLogo state="active" size="lg" />
              <h2 className="font-semibold text-sentinel-success">{t('setup.setup_complete')}</h2>
              <p className="text-sm text-sentinel-muted text-center">Alle Dienste werden konfiguriert.</p>
            </div>
          )}

          <div className="flex justify-between mt-6">
            <button onClick={() => setStep((s) => s - 1)} disabled={step === 1}
              className="text-sm text-sentinel-muted hover:text-sentinel-text px-4 py-2 disabled:opacity-30">
              {t('setup.back')}
            </button>
            {step < TOTAL_STEPS ? (
              <button onClick={() => setStep((s) => s + 1)}
                className="bg-sentinel-primary hover:bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium transition-colors">
                {t('setup.next')}
              </button>
            ) : (
              <button onClick={finish} disabled={loading}
                className="bg-sentinel-success hover:bg-emerald-600 text-white rounded px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50">
                {loading ? t('common.loading') : t('setup.finish')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
