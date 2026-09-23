import { useCallback, useEffect, useState } from 'react'

export function useResource<T>(loader: () => Promise<T>, key: string | number) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let alive = true
    setLoading(true); setError(''); setData(null)
    loader().then(value => { if (alive) setData(value) })
      .catch(error => { if (alive) setError(error.message || 'Не удалось загрузить данные.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // Loader captures the supplied key; changes are intentional through key/revision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, revision])
  return { data, setData, loading, error, retry: useCallback(() => setRevision(value => value + 1), []) }
}

export function isStringRecord(value: unknown): value is Record<string, string> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.values(value).every(item => typeof item === 'string')
}
export function readStorage<T>(key: string, fallback: T, validate?: (value: unknown) => value is T): T {
  try {
    const stored = localStorage.getItem(key)
    if (stored === null) return fallback
    const value: unknown = JSON.parse(stored)
    return !validate || validate(value) ? value as T : fallback
  } catch { return fallback }
}
export function writeStorage(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* App remains usable with storage disabled. */ }
}
