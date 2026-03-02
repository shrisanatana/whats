import { useCallback, useEffect, useState } from 'react'
import type { AppSettings, AiProvider } from '../../../shared/ipc'

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!window.api) {
      setError('Electron bridge not available. Please run in the desktop app.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const res = await window.api.getSettings()
    if (!res.ok) {
      setError(res.error.message)
      setSettings(null)
    } else {
      setSettings(res.data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const update = useCallback(
    async (partial: Partial<Omit<AppSettings, 'hasOpenAIKey' | 'hasGeminiKey' | 'whatsappStatus'>>) => {
      if (!window.api) return
      const res = await window.api.updateSettings(partial)
      if (res.ok) setSettings(res.data)
      else setError(res.error.message)
    },
    []
  )

  const saveKey = useCallback(async (provider: AiProvider, apiKey: string) => {
    if (!window.api) return
    const res = await window.api.setApiKey({ provider, apiKey })
    if (!res.ok) {
      setError(res.error.message)
      return false
    }
    await refresh()
    return true
  }, [refresh])

  return { settings, loading, error, refresh, update, saveKey }
}

