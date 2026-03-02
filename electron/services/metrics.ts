import type { Db } from './db'
import type { DashboardStats } from '../../shared/ipc'

export function bumpMessageMetrics(db: Db | null, fromMe: boolean, aiReplied: boolean) {
  if (!db) return
  const date = new Date().toISOString().slice(0, 10)
  db.prepare(
    `insert into metrics_daily(date, totalMessages, aiReplied)
     values(@date, 1, @ai)
     on conflict(date) do update set
       totalMessages = totalMessages + 1,
       aiReplied = aiReplied + @ai`
  ).run({ date, ai: aiReplied ? 1 : 0 })
}

export function getDashboard(db: Db | null): DashboardStats {
  if (!db) {
    return {
      totalMessagesToday: 0,
      newLeads: 0,
      hotLeads: 0,
      convertedCustomers: 0,
      pendingReplies: 0,
      aiRepliedCount: 0,
      revenueToday: 0,
      leadsPerDay: []
    }
  }
  const today = new Date().toISOString().slice(0, 10)
  const todayMetrics = db
    .prepare(
      `select totalMessages, newLeads, hotLeads, converted, pendingReplies, aiReplied, revenue
       from metrics_daily where date = ?`
    )
    .get(today) as
    | {
        totalMessages: number
        newLeads: number
        hotLeads: number
        converted: number
        pendingReplies: number
        aiReplied: number
        revenue: number
      }
    | undefined

  const leadsPerDayRows = db
    .prepare(
      `select date, newLeads as count
       from metrics_daily
       order by date desc
       limit 14`
    )
    .all() as Array<{ date: string; count: number }>

  const stats: DashboardStats = {
    totalMessagesToday: todayMetrics?.totalMessages ?? 0,
    newLeads: todayMetrics?.newLeads ?? 0,
    hotLeads: todayMetrics?.hotLeads ?? 0,
    convertedCustomers: todayMetrics?.converted ?? 0,
    pendingReplies: todayMetrics?.pendingReplies ?? 0,
    aiRepliedCount: todayMetrics?.aiReplied ?? 0,
    revenueToday: todayMetrics?.revenue ?? 0,
    leadsPerDay: leadsPerDayRows.reverse()
  }

  return stats
}

