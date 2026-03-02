import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type AppApi, type IpcResult } from '../shared/ipc'

console.log('[Preload] Booting...')
contextBridge.exposeInMainWorld('bridge_test', { status: 'ok' })

const api: AppApi = {
  ping: async (): Promise<IpcResult<{ app: 'whats-ai-crm'; ts: number }>> => {
    return ipcRenderer.invoke(IPC.ping)
  },
  getSettings: async () => {
    return ipcRenderer.invoke(IPC.settingsGet)
  },
  updateSettings: async (partial) => {
    return ipcRenderer.invoke(IPC.settingsUpdate, partial)
  },
  setApiKey: async (input) => {
    return ipcRenderer.invoke(IPC.settingsSetApiKey, input)
  },

  waConnect: async () => {
    return ipcRenderer.invoke(IPC.waConnect)
  },
  waDisconnect: async () => {
    return ipcRenderer.invoke(IPC.waDisconnect)
  },
  waGetChats: async () => {
    return ipcRenderer.invoke(IPC.waGetChats)
  },
  waGetMessages: async (chatId, forceSync) => {
    return ipcRenderer.invoke(IPC.waGetMessages, chatId, forceSync)
  },
  waSendMessage: async (input) => {
    return ipcRenderer.invoke(IPC.waSendMessage, input)
  },

  onWaQr: (cb) => {
    const listener = (_evt: unknown, qr: string) => cb(qr)
    ipcRenderer.on(IPC.waEvQr, listener)
    return () => ipcRenderer.removeListener(IPC.waEvQr, listener)
  },
  onWaStatus: (cb) => {
    const listener = (_evt: unknown, status: any) => cb(status)
    ipcRenderer.on(IPC.waEvStatus, listener)
    return () => ipcRenderer.removeListener(IPC.waEvStatus, listener)
  },
  onWaMessage: (cb) => {
    const listener = (_evt: unknown, msg: any) => cb(msg)
    ipcRenderer.on(IPC.waEvMessage, listener)
    return () => ipcRenderer.removeListener(IPC.waEvMessage, listener)
  },

  aiSuggestReply: async (input) => {
    return ipcRenderer.invoke(IPC.aiSuggestReply, input)
  },
  aiChat: async (input) => {
    return ipcRenderer.invoke(IPC.aiChat, input)
  },
  aiGetInsights: async () => {
    return ipcRenderer.invoke(IPC.aiGetInsights)
  },
  aiScoreLead: async (input) => {
    return ipcRenderer.invoke(IPC.aiScoreLead, input)
  },

  getDashboard: async () => ipcRenderer.invoke(IPC.getDashboard),

  listContacts: async () => ipcRenderer.invoke(IPC.listContacts),
  saveContact: async (input) => ipcRenderer.invoke(IPC.saveContact, input),
  deleteContact: async (id) => ipcRenderer.invoke(IPC.deleteContact, id),
  importContactsFromCsv: async (csv) => ipcRenderer.invoke(IPC.importContactsFromCsv, csv),
  exportContactsToCsv: async () => ipcRenderer.invoke(IPC.exportContactsToCsv),

  listGroups: async () => ipcRenderer.invoke(IPC.listGroups),
  saveGroup: async (input) => ipcRenderer.invoke(IPC.saveGroup, input),
  deleteGroup: async (id) => ipcRenderer.invoke(IPC.deleteGroup, id),

  listRules: async () => ipcRenderer.invoke(IPC.listRules),
  saveRule: async (input) => ipcRenderer.invoke(IPC.saveRule, input),
  deleteRule: async (id) => ipcRenderer.invoke(IPC.deleteRule, id),

  listCampaigns: async () => ipcRenderer.invoke(IPC.listCampaigns),
  saveCampaign: async (input) => ipcRenderer.invoke(IPC.saveCampaign, input),
  deleteCampaign: async (id) => ipcRenderer.invoke(IPC.deleteCampaign, id),

  listMemory: async () => ipcRenderer.invoke(IPC.listMemory),
  saveMemory: async (input) => ipcRenderer.invoke(IPC.saveMemory, input),
  deleteMemory: async (id) => ipcRenderer.invoke(IPC.deleteMemory, id)
}

contextBridge.exposeInMainWorld('api', api)

