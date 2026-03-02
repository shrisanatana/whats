import { useEffect, useState } from 'react'
import type { RuleSummary } from '../../../shared/ipc'

export function RulesPage() {
  const [rules, setRules] = useState<RuleSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newKeyword, setNewKeyword] = useState('')
  const [newType, setNewType] = useState<'message_contains' | 'ai_intent'>('message_contains')
  const [newTemplate, setNewTemplate] = useState('')

  const load = async () => {
    if (!window.api) return
    setLoading(true)
    const res = await window.api.listRules()
    setLoading(false)
    if (res.ok) setRules(res.data)
  }

  useEffect(() => {
    void load()
  }, [])

  const handleSave = async () => {
    if (!window.api || !newName) return
    const res = await window.api.saveRule({
      name: newName,
      keyword: newKeyword,
      triggerType: newType as any,
      actionType: 'send_message',
      actionConfig: { template: newTemplate },
      enabled: true
    })
    if (res.ok) {
      setNewName('')
      setNewKeyword('')
      setNewTemplate('')
      void load()
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.api) return
    await window.api.deleteRule(id)
    void load()
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-bold text-neutral-100 flex items-center gap-2">
          Automation Rules
          <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase">AI Powered</span>
        </div>
        <p className="mt-1 text-sm text-neutral-400">
          Set up automatic replies. Use "AI Intent" for smart, context-aware triggers.
        </p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
        <h3 className="mb-4 text-sm font-semibold text-neutral-200">Create New Rule</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[10px] text-neutral-500 uppercase font-bold">Rule Name</label>
            <input
              type="text"
              placeholder="e.g. Price Inquiry"
              className="w-full rounded-lg bg-neutral-950 border border-neutral-800 p-2 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500/50"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-neutral-500 uppercase font-bold">Trigger Type</label>
            <select
              className="w-full rounded-lg bg-neutral-950 border border-neutral-800 p-2 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500/50"
              value={newType}
              onChange={(e) => setNewType(e.target.value as any)}
            >
              <option value="message_contains">Message Contains (Simple)</option>
              <option value="ai_intent">AI Intent (Smart / Semantic)</option>
            </select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] text-neutral-500 uppercase font-bold">
              {newType === 'message_contains' ? 'Keyword / Phrase' : 'Describe the Intent (e.g. customer asking for a demo)'}
            </label>
            <input
              type="text"
              placeholder={newType === 'message_contains' ? 'price, cost, how much' : 'asking about installation prices'}
              className="w-full rounded-lg bg-neutral-950 border border-neutral-800 p-2 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500/50"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] text-neutral-500 uppercase font-bold">Auto-Reply Template</label>
            <textarea
              placeholder="Hi! Our pricing starts at $99... [Hint: use [ai] to let AI craft a dynamic response]"
              className="w-full h-24 rounded-lg bg-neutral-950 border border-neutral-800 p-2 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500/50 resize-none"
              value={newTemplate}
              onChange={(e) => setNewTemplate(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={!newName || !newTemplate}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            Create Rule
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {rules.map((rule) => (
          <div key={rule.id} className="group relative rounded-xl border border-neutral-800 bg-neutral-950 p-4 flex items-center justify-between transition-all hover:border-neutral-700">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-neutral-200">{rule.name}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${rule.triggerType === 'ai_intent'
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  }`}>
                  {rule.triggerType === 'ai_intent' ? 'AI INTENT' : 'CONTAINS'}
                </span>
                {!rule.enabled && <span className="text-[10px] text-neutral-500">DISABLED</span>}
              </div>
              <div className="mt-1 text-xs text-neutral-400">
                Trigger: <span className="text-neutral-300">"{rule.keyword}"</span>
              </div>
              <div className="mt-2 text-xs text-neutral-500 italic max-w-md truncate">
                Reply: {rule.actionConfig?.template || '—'}
              </div>
            </div>
            <button
              onClick={() => handleDelete(rule.id)}
              className="text-neutral-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}

        {rules.length === 0 && !loading && (
          <div className="rounded-xl border border-dashed border-neutral-800 p-12 text-center text-neutral-500">
            No automation rules yet. Create one above to handle common queries automatically.
          </div>
        )}
      </div>
    </div>
  )
}


