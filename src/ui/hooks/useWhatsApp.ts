import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChatMessage, ChatSummary } from '../../../shared/ipc'

export function useWhatsApp() {
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({})
  const [loadingMessages, setLoadingMessages] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const refreshChats = useCallback(async () => {
    if (!window.api) return
    const res = await window.api.waGetChats()
    if (!res.ok) {
      setError(res.error.message)
      return
    }
    setError(null)
    setChats(res.data)
    if (!activeChatId && res.data.length > 0) setActiveChatId(res.data[0]!.id)
  }, [activeChatId])

  const refreshMessages = useCallback(async (chatId: string, forceSync?: boolean) => {
    if (!window.api) return
    setLoadingMessages((prev) => ({ ...prev, [chatId]: true }))
    const res = await window.api.waGetMessages(chatId, forceSync)
    setLoadingMessages((prev) => ({ ...prev, [chatId]: false }))
    if (!res.ok) {
      setError(res.error.message)
      return
    }
    setError(null)
    setMessages((prev) => ({ ...prev, [chatId]: res.data }))
  }, [])

  useEffect(() => {
    refreshChats()
  }, [refreshChats])

  useEffect(() => {
    if (!activeChatId) return
    void refreshMessages(activeChatId)
  }, [activeChatId, refreshMessages])

  useEffect(() => {
    if (!window.api) return
    const off = window.api.onWaMessage((msg) => {
      setMessages((prev) => {
        const list = prev[msg.chatId] ?? []
        const next = list.concat(msg)
        return { ...prev, [msg.chatId]: next }
      })
      setChats((prev) =>
        prev
          .map((c) => (c.id === msg.chatId ? { ...c, lastMessageTs: msg.ts } : c))
          .slice()
          .sort((a, b) => (b.lastMessageTs ?? 0) - (a.lastMessageTs ?? 0))
      )
    })
    return () => off()
  }, [])

  const activeMessages = useMemo(() => (activeChatId ? messages[activeChatId] ?? [] : []), [activeChatId, messages])

  const sendMessage = useCallback(async (chatId: string, text: string) => {
    if (!window.api) return false
    const res = await window.api.waSendMessage({ chatId, text })
    if (!res.ok) {
      setError(res.error.message)
      return false
    }
    setError(null)
    return true
  }, [])

  return {
    chats,
    activeChatId,
    setActiveChatId,
    activeMessages,
    refreshChats,
    refreshMessages,
    loadingMessages,
    sendMessage,
    error
  }
}

