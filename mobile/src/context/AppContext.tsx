import React, { createContext, useContext, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { configure as apiConfigure } from '../api/client'

const KEY_SERVER = '@sunguard:server'
const KEY_JWT    = '@sunguard:jwt'
const KEY_USER   = '@sunguard:user'
const KEY_HIST   = '@sunguard:history'

export interface SavedServer {
  url: string
  wsPort: number
  label?: string
  lastUsed: number
}

interface AppState {
  serverUrl: string
  wsPort: number
  jwt: string | null
  user: { username: string; role: string } | null
  ready: boolean
}

interface AppCtx extends AppState {
  setServer: (url: string, wsPort?: number) => Promise<void>
  setAuth: (jwt: string, user: { username: string; role: string }) => Promise<void>
  logout: () => Promise<void>
  history: SavedServer[]
  removeServer: (url: string) => Promise<void>
}

const Ctx = createContext<AppCtx>(null as any)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    serverUrl: '', wsPort: 60036, jwt: null, user: null, ready: false,
  })
  const [history, setHistory] = useState<SavedServer[]>([])

  useEffect(() => {
    ;(async () => {
      const [url, wsPortStr, jwt, userJson, histJson] = await Promise.all([
        AsyncStorage.getItem(KEY_SERVER),
        AsyncStorage.getItem('@sunguard:wsport'),
        AsyncStorage.getItem(KEY_JWT),
        AsyncStorage.getItem(KEY_USER),
        AsyncStorage.getItem(KEY_HIST),
      ])
      const wsPort = wsPortStr ? parseInt(wsPortStr, 10) : 60036
      const user   = userJson ? JSON.parse(userJson) : null
      const hist   = histJson ? JSON.parse(histJson) : []
      if (url) apiConfigure(url, wsPort, jwt)
      setState({ serverUrl: url ?? '', wsPort, jwt, user, ready: true })
      setHistory(hist)
    })()
  }, [])

  const setServer = async (url: string, wsPort = 60036) => {
    const clean = url.trim().replace(/\/$/, '')
    await AsyncStorage.setItem(KEY_SERVER, clean)
    await AsyncStorage.setItem('@sunguard:wsport', String(wsPort))
    apiConfigure(clean, wsPort, null)
    // Add to history
    const updated: SavedServer[] = [
      { url: clean, wsPort, lastUsed: Date.now() },
      ...history.filter(h => h.url !== clean),
    ].slice(0, 6)
    await AsyncStorage.setItem(KEY_HIST, JSON.stringify(updated))
    setHistory(updated)
    setState(s => ({ ...s, serverUrl: clean, wsPort, jwt: null, user: null }))
  }

  const setAuth = async (jwt: string, user: { username: string; role: string }) => {
    await AsyncStorage.setItem(KEY_JWT, jwt)
    await AsyncStorage.setItem(KEY_USER, JSON.stringify(user))
    apiConfigure(state.serverUrl, state.wsPort, jwt)
    setState(s => ({ ...s, jwt, user }))
  }

  const logout = async () => {
    await AsyncStorage.multiRemove([KEY_JWT, KEY_USER])
    apiConfigure(state.serverUrl, state.wsPort, null)
    setState(s => ({ ...s, jwt: null, user: null }))
  }

  const removeServer = async (url: string) => {
    const updated = history.filter(h => h.url !== url)
    await AsyncStorage.setItem(KEY_HIST, JSON.stringify(updated))
    setHistory(updated)
  }

  return (
    <Ctx.Provider value={{ ...state, setServer, setAuth, logout, history, removeServer }}>
      {children}
    </Ctx.Provider>
  )
}

export const useApp = () => useContext(Ctx)
