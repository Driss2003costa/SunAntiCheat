import { getWsUrl } from './client'

type Channel = 'console' | 'alerts' | 'stats' | 'jobs'
type Handler = (data: any) => void

export class WsClient {
  private ws: WebSocket | null = null
  private token: string
  private handlers: Map<Channel, Handler[]> = new Map()
  private subscriptions = new Set<Channel>()
  private reconnectTimer: any = null
  private alive = true

  constructor(token: string) {
    this.token = token
  }

  connect() {
    const url = getWsUrl()
    if (!url) return
    this.alive = true
    this._connect(url)
  }

  private _connect(url: string) {
    try {
      this.ws = new WebSocket(url)
    } catch {
      this._scheduleReconnect(url)
      return
    }

    this.ws.onopen = () => {
      this.ws!.send(JSON.stringify({ type: 'auth', token: this.token }))
    }

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'auth_ok') {
          // Re-subscribe to all channels
          this.subscriptions.forEach(ch => {
            this.ws!.send(JSON.stringify({ type: 'subscribe', channel: ch }))
          })
        } else if (msg.channel) {
          const handlers = this.handlers.get(msg.channel as Channel) ?? []
          handlers.forEach(h => h(msg.data))
        }
      } catch {}
    }

    this.ws.onclose = () => {
      if (this.alive) this._scheduleReconnect(url)
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  private _scheduleReconnect(url: string) {
    if (!this.alive) return
    this.reconnectTimer = setTimeout(() => this._connect(url), 3000)
  }

  subscribe(channel: Channel, handler: Handler) {
    this.subscriptions.add(channel)
    if (!this.handlers.has(channel)) this.handlers.set(channel, [])
    this.handlers.get(channel)!.push(handler)
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', channel }))
    }
  }

  unsubscribe(channel: Channel, handler: Handler) {
    const list = this.handlers.get(channel) ?? []
    this.handlers.set(channel, list.filter(h => h !== handler))
    if ((this.handlers.get(channel) ?? []).length === 0) {
      this.subscriptions.delete(channel)
    }
  }

  sendCommand(command: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'console_input', command }))
    }
  }

  disconnect() {
    this.alive = false
    clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN
  }
}
