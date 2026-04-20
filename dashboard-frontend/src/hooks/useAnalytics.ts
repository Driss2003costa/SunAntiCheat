import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'

export function useAnalytics<T>(
  fetcher: (days: number) => Promise<T>,
  days: number,
  refreshInterval = 60_000
) {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setIsLoading(true)
      const result = await fetcher(days)
      setData(result)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }, [days, fetcher])

  useEffect(() => {
    load()
    const interval = setInterval(load, refreshInterval)
    return () => clearInterval(interval)
  }, [load, refreshInterval])

  return { data, isLoading, error, reload: load }
}

export function useServerStats(refreshMs = 5000) {
  return useAnalytics(async () => api.serverStatus(), 0, refreshMs)
}
