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
  const storedRole = readStorage<Role>('praktika-role', 'business')
  const [role, setRoleState] = useState<Role>(storedRole === 'student' ? 'student' : 'business')
  const [knownIds, setKnownIds] = useState<number[]>(() => {
    const value = readStorage<unknown>('praktika-tasks', [])
    return Array.isArray(value) ? value.filter(id => Number.isInteger(id) && id > 0) : []
  })
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [counts, setCounts] = useState<Record<number, number | null>>({})
  const countCache = useRef<Record<number, number | null>>({})
  const activeCounts = useRef(new Set<number>())
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
    const queue = ids.filter(id => !activeCounts.current.has(id) && (force || countCache.current[id] === undefined))
    queue.forEach(id => activeCounts.current.add(id))
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift()!
        try { countCache.current[id] = (await allProposals(id)).length }
        catch { countCache.current[id] = null }
        finally { activeCounts.current.delete(id); setCounts({ ...countCache.current }) }
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
