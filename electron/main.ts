import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { IPC, type AppSettings, type ChatMessage, type ChatSummary, type IpcResult, type SetApiKeyInput } from '../shared/ipc'
import { openDb, type Db } from './services/db'
import { getApiKey, loadSettings, setApiKey, updateSettings } from './services/settings'
import { WhatsAppService } from './services/whatsapp'
import { listChats, listMessages, upsertChat } from './services/db'
import { suggestReply } from './services/ai'
import { backupWaSessionToDb, deleteDirectoryRecursive, restoreWaSessionFromDb } from './services/waSessionVault'
import { handleIncomingMessage } from './services/rules'
import { getDashboard } from './services/metrics'
import { deleteContact, ensureContactForChat, listContacts as dbListContacts, upsertContact } from './services/contacts'
import { deleteGroup, getGroupsForContact, listGroups as dbListGroups, setContactGroups, upsertGroup } from './services/groups'

type RuleRow = {
  id: number
  name: string
  enabled: number
  triggerType: string
  keyword: string | null
  actionType: string
  actionConfig: string | null
}

type CampaignRow = {
  id: number
  name: string
  messageTemplate: string
  variables: string | null
  groupId: number | null
  status: string
  scheduledAt: number | null
}

type MemoryRow = {
  id: number
  key: string
  value: string
  category: string | null
}

let db: Db
let wa: WhatsAppService | null = null
let mainWindow: BrowserWindow | null = null

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data }
}

function err(message: string, code?: string): IpcResult<never> {
  return { ok: false, error: { message, code } }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  const preloadPath = path.join(__dirname, 'preload.js')
  console.log('[Main] Preload path:', preloadPath)
  console.log('[Main] Preload exists:', fs.existsSync(preloadPath))
  console.log('[Main] __dirname:', __dirname)
  mainWindow = win

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    win.loadURL(devUrl)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    const indexHtml = path.join(app.getAppPath(), 'dist', 'index.html')
    win.loadFile(indexHtml)
  }
}

app.whenReady().then(() => {
  const dataRoot = app.isPackaged
    ? path.join(path.dirname(app.getPath('exe')), 'data')
    : path.join(process.cwd(), 'data')

  if (!fs.existsSync(dataRoot)) fs.mkdirSync(dataRoot, { recursive: true })

  const dbPath = path.join(dataRoot, 'data.sqlite')
  db = openDb(dbPath)
  wa = new WhatsAppService(db)

  wa.on('qr', (qr) => {
    mainWindow?.webContents.send(IPC.waEvQr, qr)
  })
  wa.on('status', (status) => {
    mainWindow?.webContents.send(IPC.waEvStatus, status)
  })
  wa.on('message', (msg) => {
    mainWindow?.webContents.send(IPC.waEvMessage, msg)
    if (db && wa) {
      const settings = loadSettings(db)
      void handleIncomingMessage(
        db,
        wa,
        { chatId: msg.chatId, fromMe: msg.fromMe, body: msg.body },
        settings
      )
    }
  })

  ipcMain.handle(IPC.ping, async (): Promise<IpcResult<{ app: 'whats-ai-crm'; ts: number }>> => {
    return ok({ app: 'whats-ai-crm', ts: Date.now() })
  })

  ipcMain.handle(IPC.settingsGet, async (): Promise<IpcResult<AppSettings>> => {
    if (!db) return err('DB not ready', 'DB_NOT_READY')
    const base = loadSettings(db)
    return ok({ ...base, whatsappStatus: wa?.status() ?? 'disconnected' })
  })

  ipcMain.handle(
    IPC.settingsUpdate,
    async (_evt, partial): Promise<IpcResult<AppSettings>> => {
      if (!db) return err('DB not ready', 'DB_NOT_READY')
      try {
        return ok(updateSettings(db, partial ?? {}))
      } catch (e) {
        return err(e instanceof Error ? e.message : 'Failed to update settings', 'SETTINGS_UPDATE_FAILED')
      }
    }
  )

  ipcMain.handle(
    IPC.settingsSetApiKey,
    async (_evt, input: SetApiKeyInput): Promise<IpcResult<{ ok: true }>> => {
      if (!db) return err('DB not ready', 'DB_NOT_READY')
      try {
        setApiKey(db, input)
        return ok({ ok: true })
      } catch (e) {
        return err(e instanceof Error ? e.message : 'Failed to store API key', 'SET_API_KEY_FAILED')
      }
    }
  )

  ipcMain.handle(IPC.waConnect, async (): Promise<IpcResult<{ status: AppSettings['whatsappStatus'] }>> => {
    if (!wa) return err('WhatsApp service not ready', 'WA_NOT_READY')
    try {
      if (db) {
        const dataRoot = app.isPackaged
          ? path.join(path.dirname(app.getPath('exe')), 'data')
          : path.join(process.cwd(), 'data')
        const sessionDir = path.join(dataRoot, 'wa-session')
        await restoreWaSessionFromDb(db, sessionDir)
      }
      const dataRoot = app.isPackaged
        ? path.join(path.dirname(app.getPath('exe')), 'data')
        : path.join(process.cwd(), 'data')
      await wa.connect(dataRoot)
      return ok({ status: wa.status() })
    } catch (e) {
      return err(e instanceof Error ? e.message : 'Failed to connect WhatsApp', 'WA_CONNECT_FAILED')
    }
  })

  ipcMain.handle(IPC.waDisconnect, async (): Promise<IpcResult<{ status: AppSettings['whatsappStatus'] }>> => {
    if (!wa) return err('WhatsApp service not ready', 'WA_NOT_READY')
    try {
      await wa.disconnect()
      return ok({ status: wa.status() })
    } catch (e) {
      return err(e instanceof Error ? e.message : 'Failed to disconnect WhatsApp', 'WA_DISCONNECT_FAILED')
    }
  })

  ipcMain.handle(IPC.waGetChats, async (): Promise<IpcResult<ChatSummary[]>> => {
    if (!db) return err('DB not ready', 'DB_NOT_READY')
    if (!wa) return err('WhatsApp service not ready', 'WA_NOT_READY')
    try {
      if (wa.status() === 'ready') {
        const chats = await wa.getChats()
        for (const c of chats) {
          upsertChat(db, { id: c.id, name: c.name, isGroup: c.isGroup, lastMessageTs: c.lastMessageTs, unreadCount: c.unreadCount })
        }
        return ok(chats)
      }
      const cached = listChats(db).map((c) => ({
        id: c.id,
        name: c.name,
        isGroup: c.isGroup === 1,
        lastMessageTs: c.lastMessageTs,
        unreadCount: c.unreadCount
      }))
      return ok(cached)
    } catch (e) {
      return err(e instanceof Error ? e.message : 'Failed to fetch chats', 'WA_GET_CHATS_FAILED')
    }
  })

  ipcMain.handle(IPC.waGetMessages, async (_evt, chatId: string, forceSync?: boolean): Promise<IpcResult<ChatMessage[]>> => {
    if (!db) return err('DB not ready', 'DB_NOT_READY')
    try {
      console.log('[Main] IPC waGetMessages for', chatId, 'forceSync:', !!forceSync)
      // Background sync if ready
      if (wa && wa.status() === 'ready') {
        const dbCount = db.prepare('select count(*) as count from messages where chatId = ?').get(chatId) as { count: number }
        console.log('[Main] Current DB count for', chatId, 'is', dbCount.count)

        if (dbCount.count > 0) {
          const sample = db.prepare('select id from messages where chatId = ? limit 1').get(chatId) as { id: string }
          console.log('[Main] Sample message ID in DB for this chat:', sample.id)
        }

        if (dbCount.count === 0 || forceSync) {
          console.log('[Main] Triggering full sync (50)')
          await wa.syncMessages(chatId, 50, !!forceSync)
        } else {
          console.log('[Main] Triggering partial sync (10)')
          await wa.syncMessages(chatId, 10, false)
        }
      } else {
        console.log('[Main] WA status not ready for sync:', wa?.status())
      }

      const msgs = listMessages(db, chatId, 500)
        .slice()
        .reverse()
        .map((m) => ({
          id: m.id,
          chatId: m.chatId,
          fromMe: m.fromMe === 1,
          author: m.author,
          body: m.body,
          ts: m.ts
        }))
      console.log('[Main] Returning', msgs.length, 'messages from DB')
      return ok(msgs)
    } catch (e) {
      console.error('[Main] Fetch messages failed', e)
      return err(e instanceof Error ? e.message : 'Failed to fetch messages', 'WA_GET_MESSAGES_FAILED')
    }
  })

  ipcMain.handle(
    IPC.waSendMessage,
    async (_evt, input: { chatId: string; text: string }): Promise<IpcResult<{ ok: true }>> => {
      if (!wa) return err('WhatsApp service not ready', 'WA_NOT_READY')
      try {
        await wa.sendMessage(input.chatId, input.text)
        return ok({ ok: true })
      } catch (e) {
        return err(e instanceof Error ? e.message : 'Failed to send message', 'WA_SEND_FAILED')
      }
    }
  )

  ipcMain.handle(
    IPC.aiSuggestReply,
    async (_evt, input: { chatId: string }): Promise<IpcResult<{ text: string }>> => {
      if (!db) return err('DB not ready', 'DB_NOT_READY')
      try {
        const settings = loadSettings(db)
        const apiKey = getApiKey(db, settings.aiProvider)
        if (!apiKey) return err(`Missing API key for provider: ${settings.aiProvider}`, 'MISSING_API_KEY')

        const msgs = listMessages(db, input.chatId, 60)
          .slice()
          .reverse()
          .map((m) => ({
            id: m.id,
            chatId: m.chatId,
            fromMe: m.fromMe === 1,
            author: m.author,
            body: m.body,
            ts: m.ts
          }))

        const memoryRows = db
          .prepare('select id, key, value, category from ai_memory order by id desc limit 50')
          .all() as import('../shared/ipc').AiMemoryItem[]

        const text = await suggestReply({
          provider: settings.aiProvider,
          apiKey,
          settings,
          messages: msgs,
          memory: memoryRows
        })
        return ok({ text })
      } catch (e) {
        return err(e instanceof Error ? e.message : 'AI suggest reply failed', 'AI_SUGGEST_FAILED')
      }
    }
  )

  ipcMain.handle(
    IPC.aiChat,
    async (_evt, input: { message: string }): Promise<IpcResult<{ text: string }>> => {
      if (!db) return err('DB not ready', 'DB_NOT_READY')
      try {
        const settings = loadSettings(db)
        const apiKey = getApiKey(db, settings.aiProvider)
        if (!apiKey) return err(`Missing API key for provider: ${settings.aiProvider}`, 'MISSING_API_KEY')

        const memoryRows = db
          .prepare('select id, key, value, category from ai_memory order by id desc limit 100')
          .all() as import('../shared/ipc').AiMemoryItem[]

        const text = await (await import('./services/ai')).assistantChat({
          provider: settings.aiProvider,
          apiKey,
          message: input.message,
          settings,
          memory: memoryRows
        })
        return ok({ text })
      } catch (e) {
        return err(e instanceof Error ? e.message : 'AI assistant chat failed', 'AI_CHAT_FAILED')
      }
    }
  )

  ipcMain.handle(
    IPC.aiGetInsights,
    async (): Promise<IpcResult<{ text: string }>> => {
      if (!db) return err('DB not ready', 'DB_NOT_READY')
      try {
        const settings = loadSettings(db)
        const apiKey = getApiKey(db, settings.aiProvider)
        if (!apiKey) return err(`Missing API key for provider: ${settings.aiProvider}`, 'MISSING_API_KEY')

        const stats = getDashboard(db)
        const memoryRows = db
          .prepare('select key, value from ai_memory limit 20')
          .all() as any[]

        const text = await (await import('./services/ai')).getInsights({
          provider: settings.aiProvider,
          apiKey,
          stats,
          settings,
          recentContacts: [], // could add last 10 contacts here
          memory: memoryRows
        })
        return ok({ text })
      } catch (e) {
        return err(e instanceof Error ? e.message : 'AI insights failed', 'AI_INSIGHTS_FAILED')
      }
    }
  )

  ipcMain.handle(
    IPC.aiScoreLead,
    async (_evt, input: { chatId: string }): Promise<IpcResult<any>> => {
      if (!db) return err('DB not ready', 'DB_NOT_READY')
      try {
        const settings = loadSettings(db)
        const apiKey = getApiKey(db, settings.aiProvider)
        if (!apiKey) return err(`Missing API key for provider: ${settings.aiProvider}`, 'MISSING_API_KEY')

        const msgs = listMessages(db, input.chatId, 100)
          .slice()
          .reverse()
          .map((m) => ({
            id: m.id,
            chatId: m.chatId,
            fromMe: m.fromMe === 1,
            author: m.author,
            body: m.body,
            ts: m.ts
          }))

        const memoryRows = db
          .prepare('select key, value from ai_memory limit 50')
          .all() as any[]

        const result = await (await import('./services/ai')).scoreLead({
          provider: settings.aiProvider,
          apiKey,
          chatName: input.chatId,
          settings,
          messages: msgs,
          memory: memoryRows
        })

        // Save to DB
        upsertContact(db, {
          waId: input.chatId,
          leadScore: result.score,
          leadStatus: result.status,
          notes: result.statusReason
        })

        return ok(result)
      } catch (e) {
        return err(e instanceof Error ? e.message : 'AI lead scoring failed', 'AI_SCORE_FAILED')
      }
    }
  )

  ipcMain.handle(IPC.getDashboard, async (): Promise<IpcResult<import('../shared/ipc').DashboardStats>> => {
    try {
      return ok(getDashboard(db))
    } catch (e) {
      return err(e instanceof Error ? e.message : 'Failed to load dashboard', 'DASHBOARD_FAILED')
    }
  })

  ipcMain.handle(IPC.listContacts, async () => {
    if (!db) return err('DB not ready', 'DB_NOT_READY')
    const contacts = dbListContacts(db).map((c) => ({
      ...c,
      groupIds: getGroupsForContact(db, c.id)
    }))
    return ok(contacts)
  })

  ipcMain.handle(IPC.saveContact, async (_evt, input) => {
    if (!db) return err('DB not ready', 'DB_NOT_READY')
    const saved = upsertContact(db, {
      id: input.id,
      waId: input.waId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      businessType: input.businessType,
      tags: input.tags,
      leadStatus: input.leadStatus,
      leadScore: input.leadScore,
      notes: input.notes
    })
    if (Array.isArray(input.groupIds)) {
      setContactGroups(db, saved.id, input.groupIds)
    }
    const full = {
      ...saved,
      groupIds: getGroupsForContact(db, saved.id)
    }
    return ok(full)
  })

  ipcMain.handle(IPC.deleteContact, async (_evt, id: number) => {
    if (!db) return err('DB not ready', 'DB_NOT_READY')
    deleteContact(db, id)
    return ok({ ok: true })
  })

  ipcMain.handle(IPC.importContactsFromCsv, async (_evt, csv: string) => {
    if (!db) return err('DB not ready', 'DB_NOT_READY')
    const lines = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) return ok({ imported: 0 })
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
    const idx = (name: string) => header.indexOf(name)
    let imported = 0
    for (const line of lines.slice(1)) {
      const cols = line.split(',')
      const safe = (i: number) => (i >= 0 && i < cols.length ? cols[i].trim() : '')
      const name = safe(idx('name'))
      const phone = safe(idx('phone'))
      const email = safe(idx('email'))
      const businessType = safe(idx('business_type'))
      const tagsStr = safe(idx('tags'))
      const tags = tagsStr ? tagsStr.split('|').map((t) => t.trim()).filter(Boolean) : []
      upsertContact(db, {
        name: name || null,
        phone: phone || null,
        email: email || null,
        businessType: businessType || null,
        tags
      })
      imported++
    }
    return ok({ imported })
  })

  ipcMain.handle(IPC.exportContactsToCsv, async () => {
    if (!db) return err('DB not ready', 'DB_NOT_READY')
    const contacts = dbListContacts(db).map((c) => ({
      ...c,
      tagsJoined: c.tags.join('|')
    }))
    const header = ['name', 'phone', 'email', 'business_type', 'tags']
    const rows = contacts.map((c) =>
      [
        c.name ?? '',
        c.phone ?? '',
        c.email ?? '',
        c.businessType ?? '',
        c.tagsJoined
      ]
        .map((v) => v.replace(/"/g, '""'))
        .map((v) => `"${v}"`)
        .join(',')
    )
    const csv = [header.join(','), ...rows].join('\n')
    return ok({ csv })
  })

  ipcMain.handle(IPC.listGroups, async () => {
    if (!db) return err('DB not ready', 'DB_NOT_READY')
    return ok(dbListGroups(db))
  })

  ipcMain.handle(IPC.saveGroup, async (_evt, input) => {
    if (!db) return err('DB not ready', 'DB_NOT_READY')
    const saved = upsertGroup(db, {
      id: input.id,
      name: input.name,
      description: input.description
    })
    return ok(saved)
  })

  ipcMain.handle(IPC.deleteGroup, async (_evt, id: number) => {
    if (!db) return err('DB not ready', 'DB_NOT_READY')
    deleteGroup(db, id)
    return ok({ ok: true })
  })

  ipcMain.handle(IPC.listRules, async () => {
    if (!db) return err('DB not ready', 'DB_NOT_READY')
    const rows = db
      .prepare(
        `select id, name, enabled, triggerType, keyword, actionType, actionConfig
         from rules
         order by id desc`
      )
      .all() as RuleRow[]
    const mapped = rows.map((r) => ({
      id: r.id,
      name: r.name,
      enabled: !!r.enabled,
      triggerType: r.triggerType as 'message_contains',
      keyword: r.keyword ?? '',
      actionType: r.actionType as any,
      actionConfig: r.actionConfig ? JSON.parse(r.actionConfig) : {}
    }))
    return ok(mapped)
  })

  ipcMain.handle(IPC.saveRule, async (_evt, input) => {
    if (!db) return err('DB not ready', 'DB_NOT_READY')
    const enabled = input.enabled ?? true
    const triggerType = input.triggerType ?? 'message_contains'
    const keyword = input.keyword ?? ''
    const actionType = input.actionType ?? 'send_message'
    const actionConfig = JSON.stringify(input.actionConfig ?? {})

    if (input.id) {
      db.prepare(
        `update rules
         set name = @name,
             enabled = @enabled,
             triggerType = @triggerType,
             keyword = @keyword,
             actionType = @actionType,
             actionConfig = @actionConfig
         where id = @id`
      ).run({
        id: input.id,
        name: input.name ?? 'Rule',
        enabled: enabled ? 1 : 0,
        triggerType,
        keyword,
        actionType,
        actionConfig
      })
    } else {
      db.prepare(
        `insert into rules(name, enabled, triggerType, keyword, actionType, actionConfig)
         values(@name, @enabled, @triggerType, @keyword, @actionType, @actionConfig)`
      ).run({
        name: input.name ?? 'Rule',
        enabled: enabled ? 1 : 0,
        triggerType,
        keyword,
        actionType,
        actionConfig
      })
    }

    const idRow = db.prepare('select last_insert_rowid() as id').get() as { id: number }
    const id = input.id ?? idRow.id
    const row = db
      .prepare(
        `select id, name, enabled, triggerType, keyword, actionType, actionConfig
         from rules where id = ?`
      )
      .get(id) as RuleRow
    return ok({
      id: row.id,
      name: row.name,
      enabled: !!row.enabled,
      triggerType: row.triggerType as 'message_contains',
      keyword: row.keyword ?? '',
      actionType: row.actionType as any,
      actionConfig: row.actionConfig ? JSON.parse(row.actionConfig) : {}
    })
  })

  ipcMain.handle(IPC.deleteRule, async (_evt, id: number) => {
    if (!db) return err('DB not ready', 'DB_NOT_READY')
    db.prepare('delete from rules where id = ?').run(id)
    return ok({ ok: true })
  })

  ipcMain.handle(IPC.listCampaigns, async () => {
    if (!db) return err('DB not ready', 'DB_NOT_READY')
    const rows = db
      .prepare(
        `select id, name, messageTemplate, variables, groupId, status, scheduledAt
         from campaigns
         order by createdAt desc`
      )
      .all() as CampaignRow[]
    const mapped = rows.map((r) => ({
      id: r.id,
      name: r.name,
      messageTemplate: r.messageTemplate,
      variables: r.variables ? r.variables.split(',').map((v) => v.trim()).filter(Boolean) : [],
      groupId: r.groupId,
      status: r.status,
      scheduledAt: r.scheduledAt
    }))
    return ok(mapped)
  })

  ipcMain.handle(IPC.saveCampaign, async (_evt, input) => {
    if (!db) return err('DB not ready', 'DB_NOT_READY')
    const now = Date.now()
    const vars = (input.variables ?? []).join(',')
    const scheduledAt = input.scheduledAt ?? null
    const status = input.status ?? 'draft'

    if (input.id) {
      db.prepare(
        `update campaigns
         set name = @name,
             messageTemplate = @messageTemplate,
             variables = @variables,
             groupId = @groupId,
             status = @status,
             scheduledAt = @scheduledAt,
             updatedAt = @updatedAt
         where id = @id`
      ).run({
        id: input.id,
        name: input.name ?? 'Campaign',
        messageTemplate: input.messageTemplate ?? '',
        variables: vars,
        groupId: input.groupId ?? null,
        status,
        scheduledAt,
        updatedAt: now
      })
    } else {
      db.prepare(
        `insert into campaigns(name, messageTemplate, variables, groupId, status, scheduledAt, createdAt, updatedAt)
         values(@name, @messageTemplate, @variables, @groupId, @status, @scheduledAt, @createdAt, @updatedAt)`
      ).run({
        name: input.name ?? 'Campaign',
        messageTemplate: input.messageTemplate ?? '',
        variables: vars,
        groupId: input.groupId ?? null,
        status,
        scheduledAt,
        createdAt: now,
        updatedAt: now
      })
    }

    const idRow = db.prepare('select last_insert_rowid() as id').get() as { id: number }
    const id = input.id ?? idRow.id
    const row = db
      .prepare(
        `select id, name, messageTemplate, variables, groupId, status, scheduledAt
         from campaigns where id = ?`
      )
      .get(id) as CampaignRow
    return ok({
      id: row.id,
      name: row.name,
      messageTemplate: row.messageTemplate,
      variables: row.variables ? row.variables.split(',').map((v) => v.trim()).filter(Boolean) : [],
      groupId: row.groupId,
      status: row.status,
      scheduledAt: row.scheduledAt
    })
  })

  ipcMain.handle(IPC.deleteCampaign, async (_evt, id: number) => {
    if (!db) return err('DB not ready', 'DB_NOT_READY')
    db.prepare('delete from campaigns where id = ?').run(id)
    return ok({ ok: true })
  })

  ipcMain.handle(IPC.listMemory, async () => {
    if (!db) return err('DB not ready', 'DB_NOT_READY')
    const rows = db
      .prepare('select id, key, value, category from ai_memory order by id desc')
      .all() as MemoryRow[]
    return ok(rows)
  })

  ipcMain.handle(IPC.saveMemory, async (_evt, input) => {
    if (!db) return err('DB not ready', 'DB_NOT_READY')
    if (input.id) {
      db.prepare('update ai_memory set key = @key, value = @value, category = @category where id = @id').run({
        id: input.id,
        key: input.key ?? '',
        value: input.value ?? '',
        category: input.category ?? null
      })
    } else {
      db.prepare('insert into ai_memory(key, value, category) values(@key, @value, @category)').run({
        key: input.key ?? '',
        value: input.value ?? '',
        category: input.category ?? null
      })
    }
    const idRow = db.prepare('select last_insert_rowid() as id').get() as { id: number }
    const id = input.id ?? idRow.id
    const row = db
      .prepare('select id, key, value, category from ai_memory where id = ?')
      .get(id) as MemoryRow
    return ok(row)
  })

  ipcMain.handle(IPC.deleteMemory, async (_evt, id: number) => {
    if (!db) return err('DB not ready', 'DB_NOT_READY')
    db.prepare('delete from ai_memory where id = ?').run(id)
    return ok({ ok: true })
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async (evt) => {
  if (!db) return
  const dataRoot = app.isPackaged
    ? path.join(path.dirname(app.getPath('exe')), 'data')
    : path.join(process.cwd(), 'data')
  const sessionDir = path.join(dataRoot, 'wa-session')
  try {
    evt.preventDefault()
    await wa?.disconnect()
    await backupWaSessionToDb(db, sessionDir)
    await deleteDirectoryRecursive(sessionDir)
  } finally {
    // Continue quit after our async work
    app.exit()
  }
})

process.on('unhandledRejection', (reason, p) => {
  console.error('[Main] Unhandled Rejection at:', p, 'reason:', reason)
})
