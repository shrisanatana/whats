import type { Db } from './db'

export type Group = {
  id: number
  name: string
  description: string | null
}

export function listGroups(db: Db): Group[] {
  return db
    .prepare('select id, name, description from groups order by name collate nocase asc')
    .all() as Group[]
}

export function upsertGroup(db: Db, input: { id?: number; name: string; description?: string | null }): Group {
  if (input.id) {
    db.prepare('update groups set name = @name, description = @description where id = @id').run({
      id: input.id,
      name: input.name,
      description: input.description ?? null
    })
  } else {
    db.prepare('insert into groups(name, description) values(@name, @description)').run({
      name: input.name,
      description: input.description ?? null
    })
  }
  const idRow = db.prepare('select last_insert_rowid() as id').get() as { id: number }
  const id = input.id ?? idRow.id
  return listGroups(db).find((g) => g.id === id)!
}

export function deleteGroup(db: Db, id: number) {
  db.prepare('delete from groups where id = ?').run(id)
}

export function setContactGroups(db: Db, contactId: number, groupIds: number[]) {
  const tx = db.transaction(() => {
    db.prepare('delete from contact_groups where contactId = ?').run(contactId)
    const insert = db.prepare('insert into contact_groups(contactId, groupId) values(?, ?)')
    for (const gid of groupIds) insert.run(contactId, gid)
  })
  tx()
}

export function getGroupsForContact(db: Db, contactId: number): number[] {
  const rows = db
    .prepare('select groupId from contact_groups where contactId = ?')
    .all(contactId) as Array<{ groupId: number }>
  return rows.map((r) => r.groupId)
}

