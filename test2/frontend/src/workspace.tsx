import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { allProposals, allTasks } from './api'
import { readStorage, writeStorage } from './hooks'
import type { Role, Task } from './types'

interface Workspace {
  role: Role; setRole: (role: Role) => void
  tasks: Task[]; loading: boolean; error: string; refresh: () => Promise<void>
  knownIds: number[]; remember: (task: Task) => void
  counts: Record<number, number | null>; loadCounts: (ids: number[], force?: boolean) => Promise<void>
  toast: string; notify: (message: string) => void
}
const Context = createContext<Workspace>(null!)
export const useWorkspace = () => useContext(Context)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(() => readStorage<unknown>('praktika-role', 'business') === 'student' ? 'student' : 'business')
  const [knownIds, setKnownIds] = useState<number[]>(() => {
    const value = readStorage<unknown>('praktika-tasks', [])
    return Array.isArray(value) ? [...new Set(value.filter(id => Number.isSafeInteger(id) && id > 0))] : []
  })
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [counts, setCounts] = useState<Record<number, number | null>>({})
  const countCache = useRef<Record<number, number | null>>({})
  const activeCounts = useRef(new Map<number, { promise: Promise<void>; refreshRequested: boolean }>())
  const refreshGeneration = useRef(0)
  const [toast, setToast] = useState('')
  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current
    setLoading(true); setError('')
    try { const data = await allTasks(); if (generation === refreshGeneration.current) setTasks(data) }
    catch (error) { if (generation === refreshGeneration.current) setError((error as Error).message) }
    finally { if (generation === refreshGeneration.current) setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 6000); return () => clearTimeout(timer) } }, [toast])
  const loadCounts = useCallback(async (ids: number[], force = false) => {
    const queue = [...new Set(ids)].filter(id => Number.isSafeInteger(id) && id > 0)
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift()!
        const active = activeCounts.current.get(id)
        if (active) {
          // A forced refresh may follow a new proposal while the old count is still loading.
          if (force) active.refreshRequested = true
          await active.promise
          continue
        }
        // Failed requests remain retryable when the catalog is visited again.
        if (!force && typeof countCache.current[id] === 'number') continue
        const pending = { promise: Promise.resolve(), refreshRequested: false }
        pending.promise = (async () => {
          try {
            do {
              pending.refreshRequested = false
              try { countCache.current[id] = (await allProposals(id)).length }
              catch { countCache.current[id] = null }
              setCounts({ ...countCache.current })
            } while (pending.refreshRequested)
          } finally { activeCounts.current.delete(id) }
        })()
        activeCounts.current.set(id, pending)
        await pending.promise
      }
    }
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker))
  }, [])
  useEffect(() => { if (tasks.length) void loadCounts(tasks.map(task => task.id)) }, [tasks, loadCounts])
  function remember(task: Task) {
    setKnownIds(ids => { const next = [task.id, ...ids.filter(id => id !== task.id)]; writeStorage('praktika-tasks', next); return next })
  }
  function setRole(value: Role) { setRoleState(value); writeStorage('praktika-role', value) }
  return <Context.Provider value={{ role, setRole, tasks, loading, error, refresh, knownIds, remember, counts, loadCounts, toast, notify: setToast }}>{children}</Context.Provider>
}
