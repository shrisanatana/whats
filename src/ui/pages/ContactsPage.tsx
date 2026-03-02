import { useEffect, useMemo, useState } from 'react'
import type { ContactSummary, GroupSummary } from '../../../shared/ipc'
import { cn } from '../cn'

export function ContactsPage() {
  const [contacts, setContacts] = useState<ContactSummary[]>([])
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [csvText, setCsvText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const active = useMemo(() => contacts.find((c) => c.id === activeId) ?? null, [contacts, activeId])

  const load = async () => {
    if (!window.api) return
    const [cRes, gRes] = await Promise.all([window.api.listContacts(), window.api.listGroups()])
    if (!cRes.ok) setError(cRes.error.message)
    else {
      setContacts(cRes.data)
      setError(null)
    }
    if (gRes.ok) setGroups(gRes.data)
  }

  useEffect(() => {
    void load()
  }, [])

  const upsert = async (partial: Partial<ContactSummary>) => {
    if (!window.api) return
    const res = await window.api.saveContact(partial)
    if (!res.ok) {
      setError(res.error.message)
      return
    }
    setError(null)
    setContacts((prev) => {
      const idx = prev.findIndex((c) => c.id === res.data.id)
      if (idx === -1) return [res.data, ...prev]
      const copy = [...prev]
      copy[idx] = res.data
      return copy
    })
    setActiveId(res.data.id)
  }

  const onImportCsv = async () => {
    if (!window.api || !csvText.trim()) return
    const res = await window.api.importContactsFromCsv(csvText)
    if (!res.ok) {
      setError(res.error.message)
      return
    }
    setCsvText('')
    await load()
  }

  const onExportCsv = async () => {
    if (!window.api) return
    const res = await window.api.exportContactsToCsv()
    if (!res.ok) {
      setError(res.error.message)
      return
    }
    await navigator.clipboard.writeText(res.data.csv)
  }

  return (
    <div className="flex h-[calc(100vh-140px)] min-h-[520px] gap-4">
      <div className="flex w-[320px] flex-col rounded-lg border border-neutral-800 bg-neutral-950">
        <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
          <div className="text-sm font-medium">Contacts</div>
          <button
            className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-900"
            onClick={() => setActiveId(null)}
          >
            New
          </button>
        </div>
        {error ? <div className="px-3 py-2 text-xs text-red-200">{error}</div> : null}
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {contacts.map((c) => (
            <button
              key={c.id}
              className={cn(
                'mb-1 w-full rounded-md border border-transparent px-3 py-2 text-left hover:bg-neutral-900',
                c.id === activeId && 'border-neutral-800 bg-neutral-900'
              )}
              onClick={() => setActiveId(c.id)}
            >
              <div className="truncate text-sm text-neutral-100">{c.name || c.phone || c.waId || `#${c.id}`}</div>
              <div className="mt-0.5 text-xs text-neutral-400">
                {c.leadStatus ?? 'unclassified'} {c.businessType ? `· ${c.businessType}` : ''}
              </div>
            </button>
          ))}
          {contacts.length === 0 ? (
            <div className="px-2 py-6 text-sm text-neutral-400">
              Contacts are auto-created from new WhatsApp numbers. You can also add them manually.
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <ContactEditor contact={active} groups={groups} onSave={upsert} />

        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium">CSV Import / Export</div>
              <div className="text-xs text-neutral-400">
                Columns: name, phone, email, business_type, tags (tags separated by |). Paste CSV to import.
              </div>
            </div>
            <button
              className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-xs text-neutral-200"
              onClick={onExportCsv}
            >
              Copy CSV
            </button>
          </div>
          <textarea
            className="mt-3 h-24 w-full resize-none rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={`name,phone,email,business_type,tags\nJohn,+9112345,john@test.com,Electrician,VIP|Repeat`}
          />
          <button
            className="mt-2 rounded-md bg-neutral-100 px-3 py-2 text-xs font-medium text-neutral-900 disabled:opacity-50"
            disabled={!csvText.trim()}
            onClick={onImportCsv}
          >
            Import CSV
          </button>
        </div>
      </div>
    </div>
  )
}

function ContactEditor({
  contact,
  groups,
  onSave
}: {
  contact: ContactSummary | null
  groups: GroupSummary[]
  onSave: (c: Partial<ContactSummary>) => Promise<void>
}) {
  const [draft, setDraft] = useState<Partial<ContactSummary>>(() => contact ?? {})

  useEffect(() => {
    setDraft(contact ?? {})
  }, [contact])

  const toggleGroup = (id: number) => {
    const current = draft.groupIds ?? contact?.groupIds ?? []
    const has = current.includes(id)
    const next = has ? current.filter((g) => g !== id) : [...current, id]
    setDraft((d) => ({ ...d, groupIds: next }))
  }

  const commit = () =>
    onSave({
      ...draft,
      id: draft.id ?? contact?.id,
      tags: (draft.tags ?? contact?.tags ?? []).map((t) => t.trim()).filter(Boolean)
    })

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
      <div className="mb-3 text-sm font-medium">Contact Details</div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Name">
          <input
            className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
            value={draft.name ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </Field>
        <Field label="Phone">
          <input
            className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
            value={draft.phone ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
          />
        </Field>
        <Field label="Email">
          <input
            className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
            value={draft.email ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
          />
        </Field>
        <Field label="Business Type">
          <input
            className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
            value={draft.businessType ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, businessType: e.target.value }))}
          />
        </Field>
        <Field label="Lead Status">
          <select
            className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
            value={draft.leadStatus ?? contact?.leadStatus ?? 'new_lead'}
            onChange={(e) => setDraft((d) => ({ ...d, leadStatus: e.target.value }))}
          >
            <option value="new_lead">New Lead</option>
            <option value="interested">Interested</option>
            <option value="follow_up">Follow Up</option>
            <option value="customer">Customer</option>
            <option value="spam">Spam</option>
          </select>
        </Field>
        <Field label="Lead Score">
          <input
            type="number"
            className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
            value={draft.leadScore ?? contact?.leadScore ?? ''}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                leadScore: e.target.value ? Number(e.target.value) : null
              }))
            }
          />
        </Field>
      </div>

      <Field label="Tags (comma separated)" className="mt-3">
        <input
          className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
          value={(draft.tags ?? contact?.tags ?? []).join(', ')}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              tags: e.target.value
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            }))
          }
        />
      </Field>

      <Field label="Groups" className="mt-3">
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => {
            const current = draft.groupIds ?? contact?.groupIds ?? []
            const active = current.includes(g.id)
            return (
              <button
                key={g.id}
                type="button"
                className={cn(
                  'rounded-full border px-3 py-1 text-xs',
                  active
                    ? 'border-emerald-400 bg-emerald-950/60 text-emerald-100'
                    : 'border-neutral-700 bg-neutral-900 text-neutral-200'
                )}
                onClick={() => toggleGroup(g.id)}
              >
                {g.name}
              </button>
            )
          })}
          {groups.length === 0 ? <span className="text-xs text-neutral-500">Create groups in the Groups tab.</span> : null}
        </div>
      </Field>

      <Field label="Notes" className="mt-3">
        <textarea
          className="min-h-[80px] w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
          value={draft.notes ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
        />
      </Field>

      <div className="mt-4 flex justify-end gap-2">
        <button
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900"
          onClick={commit}
        >
          Save
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
  className
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <div className="mb-1 text-xs text-neutral-400">{label}</div>
      {children}
    </div>
  )
}

