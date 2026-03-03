import { safeStorage } from 'electron'
import { type AppSettings, type AiProvider, type SetApiKeyInput } from '../../shared/ipc'
import { type Db, getSetting, setSetting } from './db'

const SETTINGS_KEY = 'appSettings'
const SECRET_OPENAI = 'secret:openai'
const SECRET_GEMINI = 'secret:gemini'

export function getDefaultSettings(): AppSettings {
  return {
    aiProvider: 'openai',
    tone: 'professional',
    language: 'en',
    geminiModel: 'gemini-1.5-flash',
    autoReplyEnabled: false,
    hasOpenAIKey: false,
    hasGeminiKey: false,
    whatsappStatus: 'disconnected'
  }
}

function readJson<T>(db: Db, key: string): T | null {
  const raw = getSetting(db, key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson(db: Db, key: string, value: unknown) {
  setSetting(db, key, JSON.stringify(value))
}

function secretKey(provider: AiProvider) {
  return provider === 'openai' ? SECRET_OPENAI : SECRET_GEMINI
}

function hasSecret(db: Db, provider: AiProvider): boolean {
  return !!getSetting(db, secretKey(provider))
}

export function loadSettings(db: Db): AppSettings {
  const defaults = getDefaultSettings()
  const stored = readJson<Partial<AppSettings>>(db, SETTINGS_KEY) ?? {}

  const merged: AppSettings = {
    ...defaults,
    ...stored,
    hasOpenAIKey: hasSecret(db, 'openai'),
    hasGeminiKey: hasSecret(db, 'gemini')
  }

  // Never trust persisted secret flags / whatsapp status.
  merged.whatsappStatus = defaults.whatsappStatus

  return merged
}

export function updateSettings(
  db: Db,
  partial: Partial<Omit<AppSettings, 'hasOpenAIKey' | 'hasGeminiKey' | 'whatsappStatus'>>
): AppSettings {
  const current = loadSettings(db)
  const next: AppSettings = {
    ...current,
    ...partial,
    hasOpenAIKey: current.hasOpenAIKey,
    hasGeminiKey: current.hasGeminiKey,
    whatsappStatus: current.whatsappStatus
  }
  writeJson(db, SETTINGS_KEY, {
    aiProvider: next.aiProvider,
    tone: next.tone,
    language: next.language,
    geminiModel: next.geminiModel,
    autoReplyEnabled: next.autoReplyEnabled
  })
  return loadSettings(db)
}

export function setApiKey(db: Db, input: SetApiKeyInput) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS encryption is not available (safeStorage).')
  }
  const enc = safeStorage.encryptString(input.apiKey)
  setSetting(db, secretKey(input.provider), enc.toString('base64'))
}

export function getApiKey(db: Db, provider: AiProvider): string | null {
  const raw = getSetting(db, secretKey(provider))
  if (!raw) return null
  if (!safeStorage.isEncryptionAvailable()) return null
  const buf = Buffer.from(raw, 'base64')
  return safeStorage.decryptString(buf)
}

