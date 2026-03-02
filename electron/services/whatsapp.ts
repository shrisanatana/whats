import { EventEmitter } from 'node:events'
import path from 'node:path'
import { Client, LocalAuth, type Chat, type Message } from 'whatsapp-web.js'
import type { Db } from './db'
import { insertMessage, upsertChat } from './db'

export type WaStatus = 'disconnected' | 'connecting' | 'qr' | 'ready' | 'auth_failure'

type WaEvents = {
  qr: (qr: string) => void
  status: (status: WaStatus) => void
  message: (msg: { id: string; chatId: string; fromMe: boolean; author: string | null; body: string; ts: number }) => void
}

export class WhatsAppService extends EventEmitter {
  private client: Client | null = null
  private _status: WaStatus = 'disconnected'
  private readonly db: Db

  constructor(db: Db) {
    super()
    this.db = db
  }

  status(): WaStatus {
    return this._status
  }

  private setStatus(status: WaStatus) {
    this._status = status
    this.emit('status', status)
  }

  async connect(userDataDir: string) {
    if (this.client) return

    const sessionPath = path.join(userDataDir, 'wa-session')
    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'default',
        dataPath: sessionPath
      })
    })

    this.client = client
    this.setStatus('connecting')

    client.on('qr', (qr: string) => {
      this.setStatus('qr')
      this.emit('qr', qr)
    })

    client.on('ready', () => {
      this.setStatus('ready')
    })

    client.on('auth_failure', () => {
      this.setStatus('auth_failure')
    })

    client.on('disconnected', () => {
      this.setStatus('disconnected')
      void this.disconnect()
    })

    client.on('message_create', (msg: Message) => {
      const chatId = msg.fromMe ? msg.to : msg.from
      const mapped = {
        id: msg.id._serialized,
        chatId,
        fromMe: msg.fromMe,
        author: msg.author ?? null,
        body: msg.body ?? '',
        ts: (msg.timestamp ?? Math.floor(Date.now() / 1000)) * 1000
      }

      try {
        upsertChat(this.db, { id: chatId })
        insertMessage(this.db, mapped)
      } catch {
        // ignore DB failures for now
      }

      this.emit('message', mapped)
    })

    await client.initialize()
  }

  async disconnect() {
    const c = this.client
    this.client = null
    if (c) {
      try {
        await c.destroy()
      } catch {
        // ignore
      }
    }
    this.setStatus('disconnected')
  }

  async getChats(): Promise<Array<{ id: string; name: string | null; isGroup: boolean; lastMessageTs: number | null; unreadCount: number | null }>> {
    if (!this.client) return []
    const chats = await this.client.getChats()
    return chats.map(mapChat)
  }

  async sendMessage(chatId: string, text: string) {
    if (!this.client) throw new Error('WhatsApp not connected')
    await this.client.sendMessage(chatId, text)
  }

  async syncMessages(chatId: string, limit: number = 50, force: boolean = false) {
    if (!this.client || this._status !== 'ready') {
      console.log('[WA] Sync blocked: client ready status is', this._status)
      return []
    }
    try {
      console.log('[WA] syncMessages for', chatId)
      const dbCount = this.db.prepare('select count(*) as count from messages where chatId = ?').get(chatId) as { count: number }
      if (!force && dbCount.count >= limit) {
        console.log('[WA] Already have enough messages in DB for sync skip')
        return []
      }

      console.log('[WA] Calling getChatById...')
      const chat = await this.client.getChatById(chatId)
      console.log('[WA] Calling fetchMessages...')
      const msgs = await chat.fetchMessages({ limit })
      console.log('[WA] fetchMessages returned', msgs.length, 'records')

      const mapped = msgs.map((msg) => {
        const cId = msg.fromMe ? msg.to : msg.from
        return {
          id: msg.id._serialized,
          chatId: cId,
          fromMe: msg.fromMe,
          author: msg.author ?? null,
          body: msg.body ?? '',
          ts: (msg.timestamp ?? Math.floor(Date.now() / 1000)) * 1000
        }
      })

      for (const m of mapped) {
        insertMessage(this.db, m)
      }
      console.log('[WA] insertMessage loops done')

      return mapped
    } catch (e) {
      console.error('[WA] Sync failed for', chatId)
      console.error(e)
      return []
    }
  }

  override on<E extends keyof WaEvents>(event: E, listener: WaEvents[E]): this {
    return super.on(event, listener)
  }
}

function mapChat(c: Chat) {
  return {
    id: c.id._serialized,
    name: c.name ?? null,
    isGroup: c.isGroup ?? false,
    lastMessageTs: c.timestamp ? c.timestamp * 1000 : null,
    unreadCount: typeof c.unreadCount === 'number' ? c.unreadCount : null
  }
}

