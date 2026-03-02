import type { Db } from './db'
import type { AppSettings } from '../../shared/ipc'
import { bumpMessageMetrics } from './metrics'

type MessageForRules = {
  chatId: string
  fromMe: boolean
  body: string
}

type RuleRow = {
  id: number
  name: string
  enabled: number
  triggerType: string
  keyword: string | null
  actionType: string
  actionConfig: string | null
}

export async function handleIncomingMessage(
  db: Db,
  wa: { sendMessage: (chatId: string, text: string) => Promise<void> },
  msg: MessageForRules,
  settings: AppSettings
) {
  bumpMessageMetrics(db, msg.fromMe, false)

  if (msg.fromMe) return
  if (!settings.autoReplyEnabled) return

  const rules = db
    .prepare(
      `select id, name, enabled, triggerType, keyword, actionType, actionConfig
       from rules
       where enabled = 1`
    )
    .all() as RuleRow[]

  for (const r of rules) {
    const config = r.actionConfig ? JSON.parse(r.actionConfig) : {}
    let triggered = false

    if (r.triggerType === 'message_contains') {
      if (r.keyword && msg.body.toLowerCase().includes(r.keyword.toLowerCase())) {
        triggered = true
      }
    } else if (r.triggerType === 'ai_intent') {
      // Use AI to evaluate intent if keyword is missing or it's a more complex ask
      try {
        const apiKey = (await import('./settings')).getApiKey(db, settings.aiProvider)
        if (apiKey) {
          const aiRes = await (await import('./ai')).assistantChat({
            provider: settings.aiProvider,
            apiKey,
            message: `Check if this customer message matches the intent: "${r.keyword}". Message: "${msg.body}". Output ONLY "YES" or "NO".`,
          })
          if (aiRes.trim().toUpperCase().includes('YES')) triggered = true
        }
      } catch {
        // Fallback to false
      }
    }

    if (triggered) {
      if (r.actionType === 'send_message' && config.template) {
        let text: string = String(config.template)

        // AI can also customize the reply if template says [ai]
        if (text.includes('[ai]')) {
          try {
            const apiKey = (await import('./settings')).getApiKey(db, settings.aiProvider)
            if (apiKey) {
              const aiReply = await (await import('./ai')).suggestReply({
                provider: settings.aiProvider,
                apiKey,
                settings,
                messages: [{ id: 'tmp', chatId: msg.chatId, fromMe: false, author: null, body: msg.body, ts: Date.now() }],
                memory: db.prepare('select key, value from ai_memory limit 10').all() as any[]
              })
              text = text.replace('[ai]', aiReply)
            }
          } catch {
            text = text.replace('[ai]', '') // Fallback
          }
        }

        await wa.sendMessage(msg.chatId, text)
        bumpMessageMetrics(db, true, true)
      }
    }
  }
}

