import Database from 'better-sqlite3'

export type Db = Database.Database

export function openDb(dbPath: string): Db {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

function migrate(db: Db) {
  db.exec(`
    create table if not exists settings (
      key text primary key,
      value text not null
    );

    create table if not exists chats (
      id text primary key,
      name text,
      isGroup integer not null default 0,
      lastMessageTs integer,
      unreadCount integer
    );

    create table if not exists messages (
      id text primary key,
      chatId text not null,
      fromMe integer not null default 0,
      author text,
      body text not null,
      ts integer not null,
      foreign key(chatId) references chats(id) on delete cascade
    );

    create index if not exists idx_messages_chat_ts on messages(chatId, ts);

    create table if not exists wa_session_files (
      path text primary key,
      dataEnc text not null
    );

    create table if not exists contacts (
      id integer primary key autoincrement,
      waId text unique,
      name text,
      phone text,
      email text,
      businessType text,
      tags text,
      leadStatus text,
      leadScore integer,
      notes text,
      createdAt integer not null,
      updatedAt integer not null
    );

    create table if not exists groups (
      id integer primary key autoincrement,
      name text not null unique,
      description text
    );

    create table if not exists contact_groups (
      contactId integer not null,
      groupId integer not null,
      primary key (contactId, groupId),
      foreign key(contactId) references contacts(id) on delete cascade,
      foreign key(groupId) references groups(id) on delete cascade
    );

    create table if not exists ai_memory (
      id integer primary key autoincrement,
      key text not null unique,
      value text not null,
      category text
    );

    create table if not exists rules (
      id integer primary key autoincrement,
      name text not null,
      enabled integer not null default 1,
      triggerType text not null,
      keyword text,
      actionType text not null,
      actionConfig text
    );

    create table if not exists followups (
      id integer primary key autoincrement,
      contactId integer,
      chatId text,
      dueAt integer not null,
      status text not null default 'pending',
      note text,
      foreign key(contactId) references contacts(id) on delete set null
    );

    create table if not exists campaigns (
      id integer primary key autoincrement,
      name text not null,
      messageTemplate text not null,
      variables text,
      groupId integer,
      status text not null default 'draft',
      scheduledAt integer,
      createdAt integer not null,
      updatedAt integer not null,
      foreign key(groupId) references groups(id) on delete set null
    );

    create table if not exists campaign_targets (
      campaignId integer not null,
      contactId integer not null,
      status text not null default 'pending',
      lastMessageId text,
      primary key (campaignId, contactId),
      foreign key(campaignId) references campaigns(id) on delete cascade,
      foreign key(contactId) references contacts(id) on delete cascade
    );

    create table if not exists metrics_daily (
      date text primary key,
      totalMessages integer not null default 0,
      newLeads integer not null default 0,
      hotLeads integer not null default 0,
      converted integer not null default 0,
      pendingReplies integer not null default 0,
      aiReplied integer not null default 0,
      revenue real not null default 0
    );
  `)
}

export function getSetting(db: Db, key: string): string | null {
  const row = db.prepare('select value from settings where key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(db: Db, key: string, value: string) {
  db.prepare('insert into settings(key, value) values(?, ?) on conflict(key) do update set value=excluded.value').run(
    key,
    value
  )
}

export type DbChat = {
  id: string
  name: string | null
  isGroup: 0 | 1
  lastMessageTs: number | null
  unreadCount: number | null
}

export type DbMessage = {
  id: string
  chatId: string
  fromMe: 0 | 1
  author: string | null
  body: string
  ts: number
}

export function upsertChat(
  db: Db,
  input: { id: string; name?: string | null; isGroup?: boolean; lastMessageTs?: number | null; unreadCount?: number | null }
) {
  const isGroup = input.isGroup ? 1 : 0
  db.prepare(
    `
    insert into chats(id, name, isGroup, lastMessageTs, unreadCount)
    values(@id, @name, @isGroup, @lastMessageTs, @unreadCount)
    on conflict(id) do update set
      name=coalesce(excluded.name, chats.name),
      isGroup=excluded.isGroup,
      lastMessageTs=coalesce(excluded.lastMessageTs, chats.lastMessageTs),
      unreadCount=coalesce(excluded.unreadCount, chats.unreadCount)
    `
  ).run({
    id: input.id,
    name: input.name ?? null,
    isGroup,
    lastMessageTs: input.lastMessageTs ?? null,
    unreadCount: input.unreadCount ?? null
  })
}

export function insertMessage(
  db: Db,
  input: { id: string; chatId: string; fromMe: boolean; author?: string | null; body: string; ts: number }
) {
  // Ensure chat exists before message (foreign key constraint)
  upsertChat(db, { id: input.chatId, lastMessageTs: input.ts })

  db.prepare(
    `
    insert into messages(id, chatId, fromMe, author, body, ts)
    values(@id, @chatId, @fromMe, @author, @body, @ts)
    on conflict(id) do update set
      body=excluded.body,
      ts=excluded.ts
    `
  ).run({
    id: input.id,
    chatId: input.chatId,
    fromMe: input.fromMe ? 1 : 0,
    author: input.author ?? null,
    body: input.body,
    ts: input.ts
  })
}

export function listChats(db: Db): DbChat[] {
  return db
    .prepare('select id, name, isGroup, lastMessageTs, unreadCount from chats order by coalesce(lastMessageTs, 0) desc')
    .all() as DbChat[]
}

export function listMessages(db: Db, chatId: string, limit = 200): DbMessage[] {
  return db
    .prepare(
      'select id, chatId, fromMe, author, body, ts from messages where chatId = ? order by ts desc limit ?'
    )
    .all(chatId, limit) as DbMessage[]
}


