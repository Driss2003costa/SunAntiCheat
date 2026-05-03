const BASE = '/api/public'

async function post<T>(url: string, body: object): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw { status: res.status, ...data }
  return data as T
}

async function get<T>(url: string, token?: string): Promise<T> {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const data = await res.json()
  if (!res.ok) throw { status: res.status, ...data }
  return data as T
}

export type RegisterRequestResult = { uuid: string; username: string; expires_in: number }
export type RegisterVerifyResult  = { token: string; uuid: string; username: string; role: string }
export type LoginResult           = { token: string; uuid: string; username: string; role: string }
export type ForgotResult          = { uuid?: string; expires_in?: number; message: string }
export type ResetResult           = { token: string; uuid: string; username: string; role: string }
export type ActiveSanction = {
  id: string; type: string; reason: string; issued_by: string
  issued_at: number; expires_at: number | null
}
export type PlayerProfile = {
  uuid: string; username: string; email: string | null
  created_at: number; last_login: number | null; role: string; online: boolean
  playtime_seconds?: number; playtime_formatted?: string
  balance?: number
  active_sanctions?: ActiveSanction[]
}

export type DailyConfigDay = {
  day: number; displayName: string | null; icon: string | null; color: string | null
  bonusCoins: number; itemsLabel: string
}
export type DailyStatus = {
  canClaim: boolean; streak: number; nextDay: number; cooldownMs: number
  config?: { enabled: boolean; cycleDays: number; resetOnMiss: boolean; days: DailyConfigDay[] }
}
export type DailyClaimResult = {
  ok: boolean; day: number; displayName: string | null; icon: string | null
  color: string | null; bonusCoins: number; itemsLabel: string
  deliveredNow: boolean; message: string
}

export const api = {
  requestPin: (username: string) =>
    post<RegisterRequestResult>(`${BASE}/register/request`, { username }),

  verifyPin: (uuid: string, pin: string, password: string) =>
    post<RegisterVerifyResult>(`${BASE}/register/verify`, { uuid, pin, password }),

  login: (username: string, password: string) =>
    post<LoginResult>(`${BASE}/register/login`, { username, password }),

  forgotPassword: (username: string) =>
    post<ForgotResult>(`${BASE}/register/forgot`, { username }),

  resetPassword: (uuid: string, pin: string, password: string) =>
    post<ResetResult>(`${BASE}/register/reset`, { uuid, pin, password }),

  me: (token: string) =>
    get<PlayerProfile>(`${BASE}/player/me`, token),

  dailyStatus: (token: string) =>
    get<DailyStatus>(`${BASE}/player/me/daily/status`, token),

  dailyClaim: async (token: string): Promise<DailyClaimResult> => {
    const res = await fetch(`${BASE}/player/me/daily/claim`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    const data = await res.json()
    if (!res.ok) throw { status: res.status, ...data }
    return data as DailyClaimResult
  },
}

export function saveToken(token: string) { localStorage.setItem('portal_token', token) }
export function getToken(): string | null  { return localStorage.getItem('portal_token') }
export function clearToken()              { localStorage.removeItem('portal_token') }
