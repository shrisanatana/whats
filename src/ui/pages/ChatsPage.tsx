import { useMemo, useState } from 'react'
import { cn } from '../cn'
import { useWhatsApp } from '../hooks/useWhatsApp'

export function ChatsPage() {
  const { chats, activeChatId, setActiveChatId, activeMessages, sendMessage, refreshChats, refreshMessages, loadingMessages, error } = useWhatsApp()
  const [draft, setDraft] = useState('')
  const [aiBusy, setAiBusy] = useState(false)

  const activeChat = useMemo(() => chats.find((c) => c.id === activeChatId) ?? null, [activeChatId, chats])

  return (
    <div className="flex h-[calc(100vh-140px)] min-h-[520px] gap-4">
      <div className="flex w-[340px] flex-col rounded-lg border border-neutral-800 bg-neutral-950">
        <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
          <div className="text-sm font-medium">Chats</div>
          <button
            className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-900"
            onClick={() => refreshChats()}
          >
            Refresh
          </button>
        </div>
        {error ? <div className="px-3 py-2 text-sm text-red-200">{error}</div> : null}
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {chats.length === 0 ? (
            <div className="px-2 py-6 text-sm text-neutral-400">
              No chats yet. Connect WhatsApp in Settings, then come back.
            </div>
          ) : (
            chats.map((c) => (
              <button
                key={c.id}
                className={cn(
                  'mb-1 w-full rounded-md border border-transparent px-3 py-2 text-left hover:bg-neutral-900',
                  c.id === activeChatId && 'border-neutral-800 bg-neutral-900'
                )}
                onClick={() => setActiveChatId(c.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm text-neutral-100">{c.name ?? c.id}</div>
                  {c.unreadCount ? (
                    <div className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs text-white">{c.unreadCount}</div>
                  ) : null}
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-neutral-400">
                  <div>{c.isGroup ? 'Group' : 'Direct'}</div>
                  <div>{c.lastMessageTs ? new Date(c.lastMessageTs).toLocaleTimeString() : ''}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col rounded-lg border border-neutral-800 bg-neutral-950">
        <div className="border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">{activeChat ? activeChat.name ?? activeChat.id : 'Select a chat'}</div>
            <div className="mt-1 text-xs text-neutral-400 flex items-center gap-2">
              Chat ID: {activeChat?.id ?? '—'}
              {activeChatId && (
                <button
                  onClick={() => refreshMessages(activeChatId, true)}
                  className={cn(
                    "hover:text-neutral-200 transition-colors",
                    activeChatId && loadingMessages[activeChatId] && "animate-spin text-emerald-500"
                  )}
                  title="Sync recent messages"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          {activeChatId && (
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  if (!activeChatId || !window.api) return
                  setAiBusy(true)
                  await window.api.aiScoreLead({ chatId: activeChatId })
                  setAiBusy(false)
                  refreshChats() // Refresh to see updated scores (if displayed in list)
                }}
                disabled={aiBusy}
                className="text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-1 rounded hover:bg-purple-500/20 transition-colors disabled:opacity-50"
              >
                {aiBusy ? 'ANALYZING...' : 'AI SCORE LEAD'}
              </button>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3 relative">
          {activeChatId ? (
            activeMessages.length === 0 ? (
              <div className="py-6 text-sm text-neutral-400 flex flex-col items-center gap-2">
                <span>No messages cached yet.</span>
                <button
                  onClick={() => refreshMessages(activeChatId, true)}
                  className="text-xs text-neutral-500 hover:text-neutral-300 underline"
                >
                  Try syncing history
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {activeMessages.map((m) => (
                  <div key={m.id} className={cn('flex', m.fromMe ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[78%] rounded-2xl border px-3 py-2 text-sm',
                        m.fromMe
                          ? 'border-emerald-900/40 bg-emerald-950/40 text-emerald-50'
                          : 'border-neutral-800 bg-neutral-900 text-neutral-50'
                      )}
                    >
                      <div className="whitespace-pre-wrap break-words">{m.body}</div>
                      <div className="mt-1 text-right text-[10px] text-neutral-400">{new Date(m.ts).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="py-6 text-sm text-neutral-400">Pick a chat on the left.</div>
          )}
        </div>

        <div className="border-t border-neutral-800 p-3">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
              placeholder="Type a message..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={!activeChatId}
            />
            <button
              className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm font-medium text-neutral-200 disabled:opacity-50"
              disabled={!activeChatId || aiBusy}
              onClick={async () => {
                if (!activeChatId || !window.api) return
                setAiBusy(true)
                const res = await window.api.aiSuggestReply({ chatId: activeChatId })
                setAiBusy(false)
                if (res.ok) setDraft(res.data.text)
              }}
            >
              Suggest
            </button>
            <button
              className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
              disabled={!activeChatId || draft.trim().length === 0}
              onClick={async () => {
                if (!activeChatId) return
                const text = draft.trim()
                setDraft('')
                const ok = await sendMessage(activeChatId, text)
                if (!ok) setDraft(text)
              }}
            >
              Send
            </button>
          </div>
          <div className="mt-2 text-xs text-neutral-400">
            Next: lead tags, notes, AI suggest reply, summarization, and auto-reply rules.
          </div>
        </div>
      </div>
    </div>
  )
}

