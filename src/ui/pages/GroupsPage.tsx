import { useEffect, useState } from 'react'
import type { GroupSummary } from '../../../shared/ipc'

export function GroupsPage() {
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const [draft, setDraft] = useState<Partial<GroupSummary>>({})
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!window.api) return
    const res = await window.api.listGroups()
    if (!res.ok) setError(res.error.message)
    else {
      setError(null)
      setGroups(res.data)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const save = async () => {
    if (!window.api || !draft.name?.trim()) return
    const res = await window.api.saveGroup({ id: draft.id, name: draft.name.trim(), description: draft.description ?? null })
    if (!res.ok) {
      setError(res.error.message)
      return
    }
    setError(null)
    setDraft({})
    await load()
  }

  const remove = async (id: number) => {
    if (!window.api) return
    const res = await window.api.deleteGroup(id)
    if (!res.ok) {
      setError(res.error.message)
      return
    }
    await load()
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-semibold">Groups</div>
        <div className="mt-1 text-sm text-neutral-400">
          Use groups for campaigns, automation rules, and AI follow-ups (e.g. Electricians, Spa Owners, VIP Customers).
        </div>
      </div>

      {error ? <div className="rounded-md border border-red-900/60 bg-red-950/40 p-2 text-sm text-red-200">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
          <div className="mb-3 text-sm font-medium">Create / Edit Group</div>
          <div className="space-y-3 text-sm">
            <div>
              <div className="mb-1 text-xs text-neutral-400">Name</div>
              <input
                className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
                value={draft.name ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </div>
            <div>
              <div className="mb-1 text-xs text-neutral-400">Description</div>
              <textarea
                className="min-h-[60px] w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
                value={draft.description ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-200"
              onClick={() => setDraft({})}
            >
              Clear
            </button>
            <button
              className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
              disabled={!draft.name?.trim()}
              onClick={save}
            >
              Save
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
          <div className="mb-3 text-sm font-medium">Existing Groups</div>
          <div className="space-y-2 text-sm">
            {groups.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between gap-2 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2"
              >
                <div>
                  <div className="text-sm text-neutral-100">{g.name}</div>
                  {g.description ? (
                    <div className="text-xs text-neutral-400">{g.description}</div>
                  ) : (
                    <div className="text-xs text-neutral-500">No description</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-200"
                    onClick={() => setDraft(g)}
                  >
                    Edit
                  </button>
                  <button
                    className="rounded-md border border-red-900 bg-red-950/60 px-2 py-1 text-xs text-red-100"
                    onClick={() => remove(g.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {groups.length === 0 ? (
              <div className="text-xs text-neutral-500">No groups yet. Create your first segment on the left.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

