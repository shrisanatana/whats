import type { Db } from './db'

export type Contact = {
  id: number
  waId: string | null
  name: string | null
  phone: string | null
  email: string | null
  businessType: string | null
  tags: string[]
  leadStatus: string | null
  leadScore: number | null
  notes: string | null
}

export function listContacts(db: Db): Contact[] {
  const rows = db
    .prepare(
      `select id, waId, name, phone, email, businessType, tags, leadStatus, leadScore, notes
       from contacts
       order by createdAt desc`
    )
    .all() as Array<{
    id: number
    waId: string | null
    name: string | null
    phone: string | null
    email: string | null
    businessType: string | null
    tags: string | null
    leadStatus: string | null
    leadScore: number | null
    notes: string | null
  }>

  return rows.map((r) => ({
    ...r,
    tags: r.tags ? r.tags.split(',').map((t) => t.trim()).filter(Boolean) : []
  }))
}

export function upsertContact(
  db: Db,
  input: {
    id?: number
    waId?: string | null
    name?: string | null
    phone?: string | null
    email?: string | null
    businessType?: string | null
    tags?: string[]
    leadStatus?: string | null
    leadScore?: number | null
    notes?: string | null
  }
): Contact {
  const now = Date.now()
  const tags = (input.tags ?? []).join(',')

  if (input.id) {
    db.prepare(
      `update contacts
       set waId = coalesce(@waId, waId),
           name = coalesce(@name, name),
           phone = coalesce(@phone, phone),
           email = coalesce(@email, email),
           businessType = coalesce(@businessType, businessType),
           tags = @tags,
           leadStatus = coalesce(@leadStatus, leadStatus),
           leadScore = coalesce(@leadScore, leadScore),
           notes = coalesce(@notes, notes),
           updatedAt = @updatedAt
       where id = @id`
    ).run({
      id: input.id,
      waId: input.waId ?? null,
      name: input.name ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      businessType: input.businessType ?? null,
      tags,
      leadStatus: input.leadStatus ?? null,
      leadScore: input.leadScore ?? null,
      notes: input.notes ?? null,
      updatedAt: now
    })
  } else {
    db.prepare(
      `insert into contacts(waId, name, phone, email, businessType, tags, leadStatus, leadScore, notes, createdAt, updatedAt)
       values(@waId, @name, @phone, @email, @businessType, @tags, @leadStatus, @leadScore, @notes, @createdAt, @updatedAt)`
    ).run({
      waId: input.waId ?? null,
      name: input.name ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      businessType: input.businessType ?? null,
      tags,
      leadStatus: input.leadStatus ?? 'new_lead',
      leadScore: input.leadScore ?? null,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now
    })
  }

  const idRow = db.prepare('select last_insert_rowid() as id').get() as { id: number }
  const id = input.id ?? idRow.id
  return listContacts(db).find((c) => c.id === id)!
}

export function deleteContact(db: Db, id: number) {
  db.prepare('delete from contacts where id = ?').run(id)
}

export function ensureContactForChat(db: Db, chatId: string): Contact {
  const existing = db
    .prepare(
      `select id, waId, name, phone, email, businessType, tags, leadStatus, leadScore, notes
       from contacts
       where waId = ?`
    )
    .get(chatId) as
    | {
        id: number
        waId: string | null
        name: string | null
        phone: string | null
        email: string | null
        businessType: string | null
        tags: string | null
        leadStatus: string | null
        leadScore: number | null
        notes: string | null
      }
    | undefined

  if (existing) {
    return {
      ...existing,
      tags: existing.tags ? existing.tags.split(',').map((t) => t.trim()).filter(Boolean) : []
    }
  }

  const now = Date.now()
  db.prepare(
    `insert into contacts(waId, createdAt, updatedAt, leadStatus)
     values(?, ?, ?, 'new_lead')`
  ).run(chatId, now, now)
  const row = db.prepare('select last_insert_rowid() as id').get() as { id: number }
  return listContacts(db).find((c) => c.id === row.id)!
}

