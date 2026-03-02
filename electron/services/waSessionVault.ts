import { safeStorage } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Db } from './db'

type Row = { path: string; dataEnc: string }

export async function restoreWaSessionFromDb(db: Db, sessionDir: string) {
  if (!safeStorage.isEncryptionAvailable()) return
  const rows = db.prepare('select path, dataEnc from wa_session_files').all() as Row[]
  if (rows.length === 0) return

  await fs.mkdir(sessionDir, { recursive: true })

  for (const r of rows) {
    const abs = path.join(sessionDir, r.path)
    await fs.mkdir(path.dirname(abs), { recursive: true })
    const decryptedBase64 = safeStorage.decryptString(Buffer.from(r.dataEnc, 'base64'))
    const buf = Buffer.from(decryptedBase64, 'base64')
    await fs.writeFile(abs, buf)
  }
}

export async function backupWaSessionToDb(db: Db, sessionDir: string) {
  if (!safeStorage.isEncryptionAvailable()) return

  const exists = await pathExists(sessionDir)
  if (!exists) return

  const files = await listFilesRecursive(sessionDir)
  const insert = db.prepare(
    'insert into wa_session_files(path, dataEnc) values(?, ?) on conflict(path) do update set dataEnc=excluded.dataEnc'
  )

  db.prepare('delete from wa_session_files').run()

  for (const file of files) {
    const rel = path.relative(sessionDir, file).split(path.sep).join('/')
    const buf = await fs.readFile(file)
    const base64 = buf.toString('base64')
    const enc = safeStorage.encryptString(base64).toString('base64')
    insert.run(rel, enc)
  }
}

export async function deleteDirectoryRecursive(dir: string) {
  try {
    await fs.rm(dir, { recursive: true, force: true })
  } catch {
    // ignore
  }
}

async function listFilesRecursive(root: string): Promise<string[]> {
  const out: string[] = []
  const stack = [root]

  while (stack.length) {
    const current = stack.pop()!
    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const e of entries) {
      const abs = path.join(current, e.name)
      if (e.isDirectory()) stack.push(abs)
      else if (e.isFile()) out.push(abs)
    }
  }
  return out
}

async function pathExists(p: string) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

