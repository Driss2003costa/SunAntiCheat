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

export type CustomJob = {
  id: string; name: string; description?: string | null; icon?: string | null
  max_level: number; actions?: string[]; enabled?: boolean
}
export type SlotsSnapshot = { used: number; max: number; rank: string }
export type JoinResponse  = { ok: boolean; reason: string; used: number; max: number; rank: string }
export type PlayerJobProgress = {
  job_id: string; xp: number; level: number; total_earned: number
  job_name: string; max_level: number; xp_to_next: number
}
export type VipPlan = {
  id: string; displayName: string; description?: string | null
  icon?: string | null; color?: string | null
  priceEur: number; durationDays: number; perks?: string[]; order?: number
}

export type JobDynamicsSnapshot = {
  enabled: boolean
  season?: { key: string; label: string; icon: string }
  bulletin?: { job_id: string | null; multiplier: number; refreshed_at: number }
  active_events?: Array<{
    id: string; target_job: string | null
    reward_xp: number; reward_money: number
    started_at: number; ends_at: number
  }>
}

export type JobTimelinePoint = { day_ts: number; xp: number; money: number; actions: number }
export type JobTopTarget     = { target: string; actions: number; xp: number; money: number }
export type JobForecast = {
  level: number; xp: number; xp_per_hour: number
  hours_to_next?: number; hours_to_max?: number
}
export type JobTimelineResponse = {
  uuid: string; job_id: string; days: number
  timeline: JobTimelinePoint[]
  targets:  JobTopTarget[]
  xp_per_hour: number
  forecast?: JobForecast
}

export type JobHeatmapEntry  = { job_id: string; actions: number; xp: number; money: number }
export type JobHeatmapResponse = { uuid: string; days: number; by_job: JobHeatmapEntry[] }

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

  customJobsList: () =>
    get<CustomJob[]>('/api/custom-jobs/list'),

  customJobsPlayer: (uuid: string) =>
    get<PlayerJobProgress[]>(`/api/custom-jobs/player/${uuid}`),

  jobDynamics: () =>
    get<JobDynamicsSnapshot>('/api/custom-jobs/dynamics'),

  jobTimeline: (uuid: string, jobId: string, days = 30) =>
    get<JobTimelineResponse>(`/api/custom-jobs/player/${uuid}/timeline?job=${encodeURIComponent(jobId)}&days=${days}`),

  jobHeatmap: (uuid: string, days = 7) =>
    get<JobHeatmapResponse>(`/api/custom-jobs/player/${uuid}/heatmap?days=${days}`),

  jobSlots: (token: string) =>
    get<SlotsSnapshot>('/api/custom-jobs/me/slots', token),

  jobJoin: async (token: string, jobId: string): Promise<JoinResponse> => {
    const res = await fetch('/api/custom-jobs/me/join', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    })
    const data = await res.json()
    if (!res.ok) throw { status: res.status, ...data }
    return data as JoinResponse
  },

  jobLeave: async (token: string, jobId: string): Promise<JoinResponse> => {
    const res = await fetch('/api/custom-jobs/me/leave', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    })
    const data = await res.json()
    if (!res.ok) throw { status: res.status, ...data }
    return data as JoinResponse
  },

  vipPlans: () =>
    get<VipPlan[]>(`${BASE}/vip/plans`),

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
