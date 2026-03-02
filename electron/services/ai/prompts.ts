import type { AiMemoryItem, Language, Tone } from '../../../shared/ipc'

export function buildSuggestReplyPrompt(args: {
  tone: Tone
  language: Language
  conversation: Array<{ fromMe: boolean; text: string }>
  memory?: AiMemoryItem[]
}) {
  const toneLine =
    args.tone === 'friendly'
      ? 'Tone: friendly, warm, helpful.'
      : args.tone === 'aggressive_sales'
        ? 'Tone: confident, persuasive, sales-focused but not spammy.'
        : 'Tone: professional, concise, helpful.'

  const langLine =
    args.language === 'hi' ? 'Language: Hindi.' : args.language === 'mr' ? 'Language: Marathi.' : 'Language: English.'

  const memoryLines = (args.memory ?? []).map((m) => `- ${m.key}: ${m.value}`)

  const convo = args.conversation
    .slice(-30)
    .map((m) => `${m.fromMe ? 'Me' : 'Customer'}: ${m.text}`)
    .join('\n')

  return [
    'You are an autonomous WhatsApp sales assistant.',
    toneLine,
    langLine,
    'Task: Write ONE short WhatsApp reply to the customer that moves the sale forward.',
    'Rules:',
    '- Output ONLY the message to send. No quotes, no markdown, no analysis.',
    '- If you need a key detail (budget, location, requirement), ask 1-2 short questions.',
    '',
    'Business memory:',
    memoryLines.length ? memoryLines.join('\n') : '- (none yet)',
    '',
    'Conversation:',
    convo
  ].join('\n')
}

export function buildAssistantChatPrompt(args: {
  message: string
  memory?: AiMemoryItem[]
}) {
  const memoryLines = (args.memory ?? []).map((m) => `- ${m.key}: ${m.value}`)

  return [
    'You are an expert AI Business Assistant for a company using this WhatsApp CRM.',
    'Your goal is to help the user manage their business, analyze their data, and provide advice based on their stored Knowledge.',
    '',
    'Business Knowledge Base:',
    memoryLines.length ? memoryLines.join('\n') : '- (No specific business knowledge stored yet)',
    '',
    'User Message:',
    args.message,
    '',
    'Instruction:',
    '- Answer the user comprehensively but concisely.',
    '- Use the Business Knowledge Base provided above to give accurate answers about prices, services, etc.',
    '- If the knowledge base does not contain the answer, say "I don\'t have that information in my knowledge base yet. You can add it in the AI Assistant tab."'
  ].join('\n')
}

export function buildInsightsPrompt(args: {
  stats: any
  recentContacts: any[]
  memory?: AiMemoryItem[]
}) {
  return [
    'You are a Business Intelligence Assistant.',
    'Analyze the current CRM state and provide 3-4 bullet points of actionable insights or observations.',
    '',
    'Current Stats:',
    JSON.stringify(args.stats, null, 2),
    '',
    'Instructions:',
    '- Be brief and direct.',
    '- If there are "Hot Leads", mention them.',
    '- Suggest a priority for today.',
    '- Output ONLY the bullet points.'
  ].join('\n')
}

export function buildLeadScoringPrompt(args: {
  chatName: string
  conversation: Array<{ fromMe: boolean; text: string }>
  memory?: AiMemoryItem[]
}) {
  const convo = args.conversation
    .slice(-50)
    .map((m) => `${m.fromMe ? 'Agent' : 'Customer'}: ${m.text}`)
    .join('\n')

  return [
    'Analyze this WhatsApp conversation to score the lead quality.',
    'Business Context:',
    (args.memory ?? []).map((m) => `- ${m.key}: ${m.value}`).join('\n') || '- (none)',
    '',
    'Conversation:',
    convo,
    '',
    'Task: Output a valid JSON object with EXACTLY these fields:',
    '{',
    '  "score": number (0-100),',
    '  "status": string ("cold" | "warm" | "hot" | "customer"),',
    '  "statusReason": string (brief explanation)',
    '}',
    '',
    'Rules:',
    '- Output ONLY the JSON. No other text.'
  ].join('\n')
}
