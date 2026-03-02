import { useEffect, useState } from 'react'
import type { DashboardStats } from '../../../shared/ipc'

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      if (!window.api) return
      const res = await window.api.getDashboard()
      if (!mounted) return
      if (!res.ok) setError(res.error.message)
      else {
        setStats(res.data)
        setError(null)
      }
    }
    void load()
    const id = setInterval(load, 15000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  const cards: Array<{ label: string; value: number }> = [
    { label: 'Total Messages Today', value: stats?.totalMessagesToday ?? 0 },
    { label: 'New Leads', value: stats?.newLeads ?? 0 },
    { label: 'Hot Leads', value: stats?.hotLeads ?? 0 },
    { label: 'Converted Customers', value: stats?.convertedCustomers ?? 0 },
    { label: 'Pending Replies', value: stats?.pendingReplies ?? 0 },
    { label: 'AI Replied Count', value: stats?.aiRepliedCount ?? 0 }
  ]

  const maxLead = Math.max(...(stats?.leadsPerDay.map((d) => d.count) ?? [0, 1]))

  return (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-semibold text-neutral-100 flex items-center gap-2">
          Dashboard
          <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/20">LIVE</span>
        </div>
        <div className="mt-1 text-sm text-neutral-400">
          Live KPIs from WhatsApp + CRM. AI provides real-time business insights.
        </div>
      </div>

      {error ? <div className="rounded-md border border-red-900/60 bg-red-950/40 p-2 text-sm text-red-200">{error}</div> : null}

      {/* AI Insights Bar */}
      <AiInsightsSection />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
            <div className="text-xs text-neutral-400">{c.label}</div>
            <div className="mt-2 text-2xl font-semibold text-neutral-100">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
        <div className="text-sm font-medium">Leads per day</div>
        <div className="mt-3 flex h-40 items-end gap-1 overflow-x-auto rounded-md bg-neutral-950/60 p-3">
          {stats?.leadsPerDay.length ? (
            stats.leadsPerDay.map((d) => (
              <div key={d.date} className="flex flex-1 min-w-[32px] flex-col items-center gap-1 text-xs">
                <div
                  className="w-full rounded-t-md bg-emerald-500"
                  style={{ height: `${(d.count / (maxLead || 1)) * 100}%` }}
                />
                <div className="truncate text-[10px] text-neutral-400">{d.date.slice(5)}</div>
                <div className="text-[10px] text-neutral-300">{d.count}</div>
              </div>
            ))
          ) : (
            <div className="text-sm text-neutral-400">No data yet. Start chatting to see charts.</div>
          )}
        </div>
      </div>
    </div>
  )
}

function AiInsightsSection() {
  const [insight, setInsight] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (!window.api) return
    setLoading(true)
    const res = await window.api.aiGetInsights()
    if (res.ok) setInsight(res.data.text)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/10 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-2">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          AI Business Insights
        </h3>
        <button
          onClick={load}
          disabled={loading}
          className="text-[10px] text-emerald-500 hover:text-emerald-400 font-bold transition-colors disabled:opacity-50"
        >
          {loading ? 'ANALYZING...' : 'REFRESH INSIGHTS'}
        </button>
      </div>
      <div className="text-sm text-neutral-300 leading-relaxed italic">
        {loading ? (
          <div className="flex gap-1 items-center">
            <div className="w-1 h-1 bg-emerald-500 animate-bounce" />
            <div className="w-1 h-1 bg-emerald-500 animate-bounce [animation-delay:0.2s]" />
            <div className="w-1 h-1 bg-emerald-500 animate-bounce [animation-delay:0.4s]" />
          </div>
        ) : insight ? (
          insight.split('\n').filter(Boolean).map((line, i) => (
            <div key={i} className="mb-1 flex gap-2 font-not-italic">
              <span className="text-emerald-500/50">•</span>
              {line.replace(/^- /, '')}
            </div>
          ))
        ) : (
          'No insights generated yet. Click refresh to analyze your CRM data.'
        )}
      </div>
    </div>
  )
}

