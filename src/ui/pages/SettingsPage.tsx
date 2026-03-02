import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import type { AiProvider } from '../../../shared/ipc'
import { useSettings } from '../hooks/useSettings'

export function SettingsPage() {
  const { settings, loading, error, update, saveKey, refresh } = useSettings()
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [waQrUrl, setWaQrUrl] = useState<string | null>(null)
  const keyStatus = useMemo(() => {
    if (!settings) return null
    return {
      openai: settings.hasOpenAIKey ? 'Saved' : 'Missing',
      gemini: settings.hasGeminiKey ? 'Saved' : 'Missing'
    }
  }, [settings])

  const provider: AiProvider | null = settings?.aiProvider ?? null

  useEffect(() => {
    if (!window.api) return

    const offQr = window.api.onWaQr(async (qr) => {
      try {
        const url = await QRCode.toDataURL(qr)
        setWaQrUrl(url)
      } catch {
        setWaQrUrl(null)
      }
    })
    const offStatus = window.api.onWaStatus(async () => {
      setWaQrUrl(null)
      await refresh()
    })
    return () => {
      offQr()
      offStatus()
    }
  }, [refresh])

  return (
    <div className="space-y-5">
      <div>
        <div className="text-lg font-semibold">Settings</div>
        <div className="mt-1 text-sm text-neutral-400">Keys are stored locally using Windows encryption (Electron safeStorage).</div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-900/50 bg-red-950/40 p-3 text-sm text-red-200">{error}</div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
          <div className="text-sm font-medium">AI</div>
          <div className="mt-4 space-y-3">
            <label className="block">
              <div className="text-xs text-neutral-400">Provider</div>
              <select
                className="mt-1 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
                disabled={loading || !settings}
                value={settings?.aiProvider ?? 'openai'}
                onChange={(e) => update({ aiProvider: e.target.value as AiProvider })}
              >
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
              </select>
              {keyStatus ? (
                <div className="mt-1 text-xs text-neutral-400">
                  OpenAI key: <span className="text-neutral-200">{keyStatus.openai}</span> · Gemini key:{' '}
                  <span className="text-neutral-200">{keyStatus.gemini}</span>
                </div>
              ) : null}
            </label>

            <label className="block">
              <div className="text-xs text-neutral-400">Tone</div>
              <select
                className="mt-1 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
                disabled={loading || !settings}
                value={settings?.tone ?? 'professional'}
                onChange={(e) => update({ tone: e.target.value as any })}
              >
                <option value="friendly">Friendly</option>
                <option value="professional">Professional</option>
                <option value="aggressive_sales">Aggressive Sales</option>
              </select>
            </label>

            <label className="block">
              <div className="text-xs text-neutral-400">Language</div>
              <select
                className="mt-1 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
                disabled={loading || !settings}
                value={settings?.language ?? 'en'}
                onChange={(e) => update({ language: e.target.value as any })}
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="mr">Marathi</option>
              </select>
            </label>

            <label className="flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2">
              <div>
                <div className="text-sm text-neutral-200">Auto-reply</div>
                <div className="text-xs text-neutral-400">Rules engine will control actual behavior (MVP).</div>
              </div>
              <input
                type="checkbox"
                checked={!!settings?.autoReplyEnabled}
                disabled={loading || !settings}
                onChange={(e) => update({ autoReplyEnabled: e.target.checked })}
              />
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
          <div className="text-sm font-medium">API Key</div>
          <div className="mt-1 text-xs text-neutral-400">
            Save your {provider === 'gemini' ? 'Gemini' : 'OpenAI'} key (not shown again).
          </div>

          <div className="mt-4 space-y-3">
            <input
              className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
              value={apiKeyDraft}
              onChange={(e) => setApiKeyDraft(e.target.value)}
              placeholder={provider === 'gemini' ? 'AIza...' : 'sk-...'}
              type="password"
              disabled={loading || !settings}
            />
            <button
              className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
              disabled={loading || !settings || apiKeyDraft.trim().length < 8 || !provider}
              onClick={async () => {
                const ok = await saveKey(provider!, apiKeyDraft.trim())
                if (ok) setApiKeyDraft('')
              }}
            >
              Save {provider === 'gemini' ? 'Gemini' : 'OpenAI'} key
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
        <div className="text-sm font-medium">WhatsApp</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-400">
          <div>
            Status: <span className="text-neutral-200">{settings?.whatsappStatus ?? '—'}</span>
          </div>
          <button
            className="ml-auto rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
            disabled={loading || !settings}
            onClick={async () => {
              await window.api?.waConnect()
              await refresh()
            }}
          >
            Connect
          </button>
          <button
            className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm font-medium text-neutral-200 disabled:opacity-50"
            disabled={loading || !settings}
            onClick={async () => {
              await window.api?.waDisconnect()
              await refresh()
            }}
          >
            Disconnect
          </button>
        </div>

        {waQrUrl ? (
          <div className="mt-4">
            <div className="text-xs text-neutral-400">Scan this QR code in WhatsApp → Linked devices.</div>
            <div className="mt-2 inline-block rounded-lg border border-neutral-800 bg-white p-2">
              <img src={waQrUrl} alt="WhatsApp QR" className="h-56 w-56" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

