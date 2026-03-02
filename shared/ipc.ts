export type IpcOk<T> = { ok: true; data: T }
export type IpcErr = { ok: false; error: { message: string; code?: string } }
export type IpcResult<T> = IpcOk<T> | IpcErr

export type AiProvider = 'openai' | 'gemini'
export type Tone = 'friendly' | 'professional' | 'aggressive_sales'
export type Language = 'en' | 'hi' | 'mr'

export type AppSettings = {
  aiProvider: AiProvider
  tone: Tone
  language: Language
  autoReplyEnabled: boolean
  hasOpenAIKey: boolean
  hasGeminiKey: boolean
  whatsappStatus: 'disconnected' | 'connecting' | 'qr' | 'ready' | 'auth_failure'
}

export type SetApiKeyInput = { provider: AiProvider; apiKey: string }

export type WaStatus = AppSettings['whatsappStatus']

export type ChatSummary = {
  id: string
  name: string | null
  isGroup: boolean
  lastMessageTs: number | null
  unreadCount: number | null
}

export type ChatMessage = {
  id: string
  chatId: string
  fromMe: boolean
  author: string | null
  body: string
  ts: number
}

export type AiSuggestReplyResult = { text: string }
export type AiChatResult = { text: string }
export type AiInsightsResult = { text: string }
export type AiScoreLeadResult = { score: number; status: string; statusReason: string }



export type ContactSummary = {
  id: number
  waId: string | null
  name: string | null
  phone: string | null
  email: string | null
  businessType: string | null
  tags: string[]
  leadStatus: string | null
  leadScore: number | null
  notes: string | null
  groupIds: number[]
}

export type GroupSummary = {
  id: number
  name: string
  description: string | null
}

export type RuleSummary = {
  id: number
  name: string
  enabled: boolean
  triggerType: 'message_contains' | 'ai_intent'
  keyword: string
  actionType: 'send_message' | 'add_tag' | 'add_group' | 'create_followup'
  actionConfig: any
}

export type CampaignSummary = {
  id: number
  name: string
  messageTemplate: string
  variables: string[]
  groupId: number | null
  status: string
  scheduledAt: number | null
}

export type AiMemoryItem = {
  id: number
  key: string
  value: string
  category: string | null
}

export type DashboardStats = {
  totalMessagesToday: number
  newLeads: number
  hotLeads: number
  convertedCustomers: number
  pendingReplies: number
  aiRepliedCount: number
  revenueToday: number
  leadsPerDay: Array<{ date: string; count: number }>
}

export type AppApi = {
  ping: () => Promise<IpcResult<{ app: 'whats-ai-crm'; ts: number }>>
  getSettings: () => Promise<IpcResult<AppSettings>>
  updateSettings: (partial: Partial<Omit<AppSettings, 'hasOpenAIKey' | 'hasGeminiKey' | 'whatsappStatus'>>) => Promise<IpcResult<AppSettings>>
  setApiKey: (input: SetApiKeyInput) => Promise<IpcResult<{ ok: true }>>

  waConnect: () => Promise<IpcResult<{ status: WaStatus }>>
  waDisconnect: () => Promise<IpcResult<{ status: WaStatus }>>
  waGetChats: () => Promise<IpcResult<ChatSummary[]>>
  waGetMessages: (chatId: string, forceSync?: boolean) => Promise<IpcResult<ChatMessage[]>>
  waSendMessage: (input: { chatId: string; text: string }) => Promise<IpcResult<{ ok: true }>>

  onWaQr: (cb: (qr: string) => void) => () => void
  onWaStatus: (cb: (status: WaStatus) => void) => () => void
  onWaMessage: (cb: (msg: ChatMessage) => void) => () => void

  aiSuggestReply: (input: { chatId: string }) => Promise<IpcResult<AiSuggestReplyResult>>
  aiChat: (input: { message: string }) => Promise<IpcResult<AiChatResult>>
  aiGetInsights: () => Promise<IpcResult<AiInsightsResult>>
  aiScoreLead: (input: { chatId: string }) => Promise<IpcResult<AiScoreLeadResult>>



  getDashboard: () => Promise<IpcResult<DashboardStats>>

  listContacts: () => Promise<IpcResult<ContactSummary[]>>
  saveContact: (input: Partial<ContactSummary>) => Promise<IpcResult<ContactSummary>>
  deleteContact: (id: number) => Promise<IpcResult<{ ok: true }>>
  importContactsFromCsv: (csv: string) => Promise<IpcResult<{ imported: number }>>
  exportContactsToCsv: () => Promise<IpcResult<{ csv: string }>>

  listGroups: () => Promise<IpcResult<GroupSummary[]>>
  saveGroup: (input: Partial<GroupSummary>) => Promise<IpcResult<GroupSummary>>
  deleteGroup: (id: number) => Promise<IpcResult<{ ok: true }>>

  listRules: () => Promise<IpcResult<RuleSummary[]>>
  saveRule: (input: Partial<RuleSummary>) => Promise<IpcResult<RuleSummary>>
  deleteRule: (id: number) => Promise<IpcResult<{ ok: true }>>

  listCampaigns: () => Promise<IpcResult<CampaignSummary[]>>
  saveCampaign: (input: Partial<CampaignSummary>) => Promise<IpcResult<CampaignSummary>>
  deleteCampaign: (id: number) => Promise<IpcResult<{ ok: true }>>

  listMemory: () => Promise<IpcResult<AiMemoryItem[]>>
  saveMemory: (input: Partial<AiMemoryItem>) => Promise<IpcResult<AiMemoryItem>>
  deleteMemory: (id: number) => Promise<IpcResult<{ ok: true }>>
}

export const IPC = {
  ping: 'app:ping',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  settingsSetApiKey: 'settings:setApiKey',

  waConnect: 'wa:connect',
  waDisconnect: 'wa:disconnect',
  waGetChats: 'wa:getChats',
  waGetMessages: 'wa:getMessages',
  waSendMessage: 'wa:sendMessage',

  waEvQr: 'wa:ev:qr',
  waEvStatus: 'wa:ev:status',
  waEvMessage: 'wa:ev:message',

  aiSuggestReply: 'ai:suggestReply',
  aiChat: 'ai:chat',
  aiGetInsights: 'ai:getInsights',
  aiScoreLead: 'ai:scoreLead',



  getDashboard: 'dashboard:get',

  listContacts: 'contacts:list',
  saveContact: 'contacts:save',
  deleteContact: 'contacts:delete',
  importContactsFromCsv: 'contacts:importCsv',
  exportContactsToCsv: 'contacts:exportCsv',

  listGroups: 'groups:list',
  saveGroup: 'groups:save',
  deleteGroup: 'groups:delete',

  listRules: 'rules:list',
  saveRule: 'rules:save',
  deleteRule: 'rules:delete',

  listCampaigns: 'campaigns:list',
  saveCampaign: 'campaigns:save',
  deleteCampaign: 'campaigns:delete',

  listMemory: 'memory:list',
  saveMemory: 'memory:save',
  deleteMemory: 'memory:delete'
} as const

