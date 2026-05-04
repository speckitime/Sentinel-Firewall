import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SentinelStore {
  token: string | null
  isAuthenticated: boolean
  setupComplete: boolean
  language: 'de' | 'en'
  setToken: (token: string) => void
  logout: () => void
  setSetupComplete: (done: boolean) => void
  setLanguage: (lang: 'de' | 'en') => void
}

export const useStore = create<SentinelStore>()(
  persist(
    (set) => ({
      token: null,
      isAuthenticated: false,
      setupComplete: false,
      language: 'de',
      setToken: (token) => set({ token, isAuthenticated: true }),
      logout: () => set({ token: null, isAuthenticated: false }),
      setSetupComplete: (done) => set({ setupComplete: done }),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'sentinel-store',
      partialize: (state) => ({
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        setupComplete: state.setupComplete,
        language: state.language,
      }),
    }
  )
)
