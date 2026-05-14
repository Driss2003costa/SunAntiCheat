import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '../stores/authStore'

// URL par défaut du WebSocket admin :
//  - En production derrière un reverse proxy TLS (page en HTTPS) on passe par
//    le même origin + le chemin `/ws/` que nginx proxifie vers le backend.
//    Aucun port custom à exposer côté navigateur, pas de souci de mixed-content.
//  - En dev (page en HTTP, typiquement localhost:5173) on tape directement le
//    port 60036 du serveur Java.
// Override possible via VITE_WS_URL au build pour les setups exotiques.
function defaultWsUrl(): string {
  if (typeof window === 'undefined') return ''
  if (window.location.protocol === 'https:') {
    return `wss://${window.location.host}/ws/`
  }
  return `ws://${window.location.hostname}:60036`
}

const WS_URL = import.meta.env.VITE_WS_URL || defaultWsUrl()

type MessageHandler = (msg: any) => void

export function useWebSocket(channels: string[], onMessage: MessageHandler) {
  const ws = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()
  const delay = useRef(1000)
  const token = useAuthStore.getState().token

  const connect = useCallback(() => {
    if (!token) return
    // Le constructeur peut throw (mixed content, URL invalide, etc.).
    // On capture pour ne pas planter l'arbre React qui appelle ce hook.
    try {
      ws.current = new WebSocket(WS_URL)
    } catch (e) {
      console.warn('[useWebSocket] connection failed:', e)
      reconnectTimer.current = setTimeout(() => {
        delay.current = Math.min(delay.current * 2, 30000)
        connect()
      }, delay.current)
      return
    }

    ws.current.onopen = () => {
      delay.current = 1000
      // Authenticate
      ws.current?.send(JSON.stringify({ type: 'auth', token }))
    }

    ws.current.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        // After auth_ok, subscribe to channels
        if (msg.type === 'auth_ok') {
          channels.forEach(ch =>
            ws.current?.send(JSON.stringify({ type: 'subscribe', channel: ch }))
          )
        }
        onMessage(msg)
      } catch {}
    }

    ws.current.onclose = () => {
      reconnectTimer.current = setTimeout(() => {
        delay.current = Math.min(delay.current * 2, 30000)
        connect()
      }, delay.current)
    }

    ws.current.onerror = () => ws.current?.close()
  }, [token, channels.join(',')])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      ws.current?.close()
    }
  }, [connect])

  const send = useCallback((data: object) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data))
    }
  }, [])

  return { send }
}
