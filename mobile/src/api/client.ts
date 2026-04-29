let BASE = ''
let WS_PORT = 60036
let TOKEN: string | null = null

export function configure(baseUrl: string, wsPort: number, token: string | null) {
  BASE = baseUrl.replace(/\/$/, '')
  WS_PORT = wsPort
  TOKEN = token
}

export function setToken(token: string | null) { TOKEN = token }
export function getWsUrl(): string {
  if (!BASE) return ''
  try {
    const u = new URL(BASE)
    u.protocol = u.protocol.replace('http', 'ws')
    u.port = String(WS_PORT)
    u.pathname = '/'
    return u.toString()
  } catch {
    return ''
  }
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as any),
  }
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`
  const res = await fetch(`${BASE}${path}`, { ...opts, headers })
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText)
    throw new Error(msg || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as any
  return res.json()
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export const login = (username: string, password: string, totp?: string) =>
  req<{ token: string; username: string; role: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, totp }),
  })

export const me = () =>
  req<{ username: string; role: string }>('/api/auth/me')

// ── Server ────────────────────────────────────────────────────────────────────
export const serverStatus = () =>
  req<any>('/api/server/status')

export const serverPlayers = () =>
  req<any[]>('/api/server/players')

export const serverWorlds = () =>
  req<any[]>('/api/server/worlds')

export const kick = (name: string, reason = 'Expulsé par admin') =>
  req('/api/server/kick', { method: 'POST', body: JSON.stringify({ name, reason }) })

export const sendCommand = (command: string) =>
  req('/api/server/command', { method: 'POST', body: JSON.stringify({ command }) })

// ── Security / Alerts ────────────────────────────────────────────────────────
export const securityAlerts = (limit = 50) =>
  req<any[]>(`/api/security/alerts?limit=${limit}`)

// ── Sanctions ─────────────────────────────────────────────────────────────────
export const sanctions = (params?: { limit?: number; type?: string }) => {
  const q = new URLSearchParams()
  if (params?.limit) q.set('limit', String(params.limit))
  if (params?.type)  q.set('type',  params.type)
  return req<any[]>(`/api/sanctions?${q}`)
}

export const sanction = (data: {
  playerName: string; playerUuid?: string; type: string
  reason: string; durationMs?: number
}) => req('/api/sanctions', { method: 'POST', body: JSON.stringify(data) })

export const revokesSanction = (id: string) =>
  req(`/api/sanctions/${id}/revoke`, { method: 'POST' })

// ── Violations ────────────────────────────────────────────────────────────────
export const violationsTop = (limit = 50) =>
  req<{ offenders: any[] }>(`/api/violations/top?limit=${limit}`)

export const playerViolations = (name: string) =>
  req<any>(`/api/players/${name}/violations`)

export const resetViolations = (uuid: string) =>
  req(`/api/violations/${uuid}/reset`, { method: 'POST' })

// ── Players ───────────────────────────────────────────────────────────────────
export const playerProfile = (name: string) =>
  req<any>(`/api/players/${name}/profile`)

export const playerAlts = (name: string) =>
  req<any>(`/api/players/${name}/alts`)

export const playerLog = (name: string, page = 0, limit = 30) =>
  req<any[]>(`/api/players/${name}/log?page=${page}&limit=${limit}`)

// ── Honeypot ──────────────────────────────────────────────────────────────────
export const honeypotAlerts = (limit = 50) =>
  req<any[]>(`/api/honeypot/alerts?limit=${limit}`)

export const honeypotTraps = () =>
  req<any[]>('/api/honeypot/traps')

// ── Reports ───────────────────────────────────────────────────────────────────
export const reports = () =>
  req<any[]>('/api/security/reports')

export const resolveReport = (id: string) =>
  req(`/api/security/reports/${id}`, { method: 'POST' })

// ── Economy / Analytics ───────────────────────────────────────────────────────
export const economySummary = () =>
  req<any>('/api/economy/summary')

export const analyticsAlerts = () =>
  req<any[]>('/api/analytics/alerts')

// ── Mobile push ───────────────────────────────────────────────────────────────
export const registerPush = (token: string, deviceName: string, username: string) =>
  req('/api/mobile/push/register', {
    method: 'POST',
    body: JSON.stringify({ token, deviceName, username }),
  })

// ── World PvP ─────────────────────────────────────────────────────────────────
export const togglePvp = (world: string) =>
  req(`/api/server/worlds/${world}/pvp`, { method: 'POST' })

// ── Panic ─────────────────────────────────────────────────────────────────────
export const panicStatus = () =>
  req<{ active: boolean; reason?: string }>('/api/panic/status')

export const panicActivate = (reason: string) =>
  req('/api/panic/activate', { method: 'POST', body: JSON.stringify({ reason }) })

export const panicDeactivate = () =>
  req('/api/panic/deactivate', { method: 'POST' })
