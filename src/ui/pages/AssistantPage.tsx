import { useEffect, useState } from 'react'
import type { AiMemoryItem } from '../../../shared/ipc'

export function AssistantPage() {
  const [memory, setMemory] = useState<AiMemoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newCategory, setNewCategory] = useState('')

  // AI Assistant Chat state
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const load = async () => {
    if (!window.api) return
    setLoading(true)
    const res = await window.api.listMemory()
    setLoading(false)
    if (res.ok) {
      setMemory(res.data)
      setError(null)
    } else {
      setError(res.error.message)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleSave = async () => {
    if (!window.api || !newKey || !newValue) return
    const res = await window.api.saveMemory({
      key: newKey,
      value: newValue,
      category: newCategory || null
    })
    if (res.ok) {
      setNewKey('')
      setNewValue('')
      setNewCategory('')
      void load()
    } else {
      setError(res.error.message)
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.api) return
    const res = await window.api.deleteMemory(id)
    if (res.ok) {
      void load()
    } else {
      setError(res.error.message)
    }
  }

  const handleChatSend = async () => {
    if (!window.api || !chatInput || chatLoading) return
    const text = chatInput
    setChatInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setChatLoading(true)

    const res = await window.api.aiChat({ message: text })
    setChatLoading(false)

    if (res.ok) {
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data.text }])
    } else {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${res.error.message}` }])
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-bold text-neutral-100">AI Assistant</div>
          <p className="mt-1 text-sm text-neutral-400">
            Manage what your AI knows about your business. This "Memory" is used to suggest replies and assist with customer queries.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {/* Add Memory Section */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
            <h3 className="mb-4 text-sm font-semibold text-neutral-200 flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add New Knowledge
            </h3>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Key / Concept</label>
                  <input
                    type="text"
                    placeholder="e.g. PRICING_PLAN"
                    className="w-full rounded-lg bg-neutral-950 border border-neutral-800 p-2 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500/50"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Business"
                    className="w-full rounded-lg bg-neutral-950 border border-neutral-800 p-2 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500/50"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Knowledge Content / Value</label>
                <textarea
                  placeholder="Describe details here... info the AI should recall."
                  className="w-full h-32 rounded-lg bg-neutral-950 border border-neutral-800 p-2 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500/50 resize-none"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSave}
                disabled={!newKey || !newValue}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Knowledge
              </button>
            </div>
          </div>

          {/* Memory List */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-neutral-200 flex items-center justify-between">
              <span>Knowledge Base</span>
              <span className="text-xs font-normal text-neutral-500">{memory.length} items</span>
            </h3>

            {loading ? (
              <div className="flex items-center justify-center p-12 text-neutral-500">
                <div className="animate-pulse">Loading memory...</div>
              </div>
            ) : memory.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-800 p-12 text-center text-neutral-500">
                No knowledge stored yet.
              </div>
            ) : (
              <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {memory.map((item) => (
                  <div key={item.id} className="group relative rounded-xl border border-neutral-800 bg-neutral-950 p-4 transition-all hover:border-neutral-700">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                          {item.key}
                        </span>
                        {item.category && (
                          <span className="text-[10px] text-neutral-400 border border-neutral-800 px-1.5 py-0.5 rounded">
                            {item.category}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-neutral-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed line-clamp-3">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AI Preview Section */}
        <div className="flex flex-col rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden">
          <div className="border-b border-neutral-800 bg-neutral-900/30 p-4">
            <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              AI Assistant Chat
            </h3>
            <p className="text-[11px] text-neutral-500 mt-0.5">Test how your assistant responds with current knowledge.</p>
          </div>

          <div className="flex-1 p-4 space-y-4 min-h-[400px] overflow-y-auto custom-scrollbar bg-neutral-950/50">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-12 h-12 rounded-full bg-neutral-900 flex items-center justify-center mb-4 border border-neutral-800">
                  <svg className="w-6 h-6 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <p className="text-sm text-neutral-500 italic">No messages yet. Try asking about your business!</p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-br-none'
                    : 'bg-neutral-800 text-neutral-200 rounded-bl-none border border-neutral-700'
                    }`}>
                    {m.content}
                  </div>
                </div>
              ))
            )}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-neutral-800 rounded-2xl rounded-bl-none border border-neutral-700 px-3 py-2 flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-neutral-800 bg-neutral-950/80">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ask your assistant anything..."
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500/50"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
              />
              <button
                onClick={handleChatSend}
                disabled={!chatInput || chatLoading}
                className="bg-emerald-600 p-2 rounded-lg text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}



