import type { AiMemoryItem, AiProvider, AppSettings, ChatMessage } from '../../../shared/ipc'
import { buildAssistantChatPrompt, buildInsightsPrompt, buildLeadScoringPrompt, buildSuggestReplyPrompt } from './prompts'
import { geminiSuggestReply } from './gemini'
import { openaiSuggestReply } from './openai'

export async function suggestReply(args: {
  provider: AiProvider
  apiKey: string
  settings: Pick<AppSettings, 'tone' | 'language'>
  messages: ChatMessage[]
  memory?: AiMemoryItem[]
}) {
  const prompt = buildSuggestReplyPrompt({
    tone: args.settings.tone,
    language: args.settings.language,
    conversation: args.messages.map((m) => ({ fromMe: m.fromMe, text: m.body })),
    memory: args.memory
  })

  return executePrompt(args.provider, args.apiKey, prompt)
}

export async function assistantChat(args: {
  provider: AiProvider
  apiKey: string
  message: string
  memory?: AiMemoryItem[]
}) {
  const prompt = buildAssistantChatPrompt({
    message: args.message,
    memory: args.memory
  })

  return executePrompt(args.provider, args.apiKey, prompt)
}

export async function scoreLead(args: {
  provider: AiProvider
  apiKey: string
  chatName: string
  messages: ChatMessage[]
  memory?: AiMemoryItem[]
}) {
  const prompt = buildLeadScoringPrompt({
    chatName: args.chatName,
    conversation: args.messages.map((m) => ({ fromMe: m.fromMe, text: m.body })),
    memory: args.memory
  })

  const raw = await executePrompt(args.provider, args.apiKey, prompt)
  try {
    return JSON.parse(raw) as { score: number; status: string; statusReason: string }
  } catch {
    return { score: 0, status: 'cold', statusReason: 'Failed to analyze' }
  }
}

export async function getInsights(args: {
  provider: AiProvider
  apiKey: string
  stats: any
  recentContacts: any[]
  memory?: AiMemoryItem[]
}) {
  const prompt = buildInsightsPrompt({
    stats: args.stats,
    recentContacts: args.recentContacts,
    memory: args.memory
  })

  return executePrompt(args.provider, args.apiKey, prompt)
}

async function executePrompt(provider: AiProvider, apiKey: string, prompt: string) {
  if (provider === 'gemini') {
    return geminiSuggestReply({ apiKey, prompt })
  }
  return openaiSuggestReply({ apiKey, prompt })
}

