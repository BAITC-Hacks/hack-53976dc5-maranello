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

export function readStorage<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback } catch { return fallback }
}
export function writeStorage(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* App remains usable with storage disabled. */ }
}
