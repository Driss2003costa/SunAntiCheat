const BASE = '/api/public'

/**
 * Notifie l'app qu'on a touché un 503 maintenance globale → la lockdown UI
 * doit se remettre en place sans attendre le prochain poll.
 */
function fireMaintenance() {
  try { window.dispatchEvent(new CustomEvent('portal:maintenance')) } catch {}
}

function handleMaintenance(status: number, data: any): boolean {
  if (status === 503 && data?.global === true) {
    fireMaintenance()
    return true
  }
  return false
}

/**
 * Détecte les 403 liés au statut du compte (banni, section bloquée) et notifie
 * l'app via des événements. Le caller reçoit toujours l'erreur via throw pour
 * pouvoir l'afficher localement si besoin.
 */
function handleAccountStatus(status: number, data: any) {
  if (status !== 403 || !data) return
  if (data.error === 'banned') {
    try { window.dispatchEvent(new CustomEvent('portal:banned', { detail: data })) } catch {}
    // Côté authentifié : on retire le token pour que le portail bascule sur l'écran de ban
    clearToken()
  } else if (data.error === 'section_blocked') {
    try { window.dispatchEvent(new CustomEvent('portal:section-blocked', { detail: data })) } catch {}
  }
}

/**
 * Capture le header `X-Refresh-Token` émis par le backend quand le token
 * portail approche son expiration (15 min). Le nouveau token écrase l'ancien
 * dans le localStorage pour maintenir la session active tant que l'utilisateur
 * navigue. Idle &gt; 15 min → reconnexion forcée.
 */
function consumeRefreshToken(res: Response) {
  try {
    const fresh = res.headers.get('X-Refresh-Token')
    if (fresh && getToken()) localStorage.setItem('portal_token', fresh)
  } catch { /* localStorage indisponible */ }
}

async function post<T>(url: string, body: object): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  consumeRefreshToken(res)
  const data = await res.json()
  if (!res.ok) {
    handleMaintenance(res.status, data)
    handleAccountStatus(res.status, data)
    throw { status: res.status, ...data }
  }
  return data as T
}

function on401() {
  clearToken()
  window.location.replace('/portal/login')
}

async function get<T>(url: string, token?: string): Promise<T> {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  consumeRefreshToken(res)
  if (res.status === 401 && token) { on401(); throw { status: 401 } }
  const data = await res.json()
  if (!res.ok) {
    handleMaintenance(res.status, data)
    handleAccountStatus(res.status, data)
    throw { status: res.status, ...data }
  }
  return data as T
}

async function authPost<T>(url: string, token: string, body: object, redirectOn401 = true): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  consumeRefreshToken(res)
  if (res.status === 401) {
    if (redirectOn401) { on401() }
    throw { status: 401 }
  }
  const data = await res.json()
  if (!res.ok) {
    handleMaintenance(res.status, data)
    handleAccountStatus(res.status, data)
    throw { status: res.status, ...data }
  }
  return data as T
}

export type RegisterRequestResult = { uuid: string; username: string; expires_in: number }
export type RegisterVerifyResult  = { token: string; uuid: string; username: string; role: string }
export type CaptchaChallenge      = { id: string; question: string; expires_in: number }
export type LoginResult           = {
  token: string; uuid: string; username: string; role: string
  restrictions?: string[]
  must_reset_password?: boolean
}
export type ForgotResult          = { uuid?: string; expires_in?: number; message: string }
export type ResetResult           = { token: string; uuid: string; username: string; role: string }
export type ActiveSanction = {
  id: string; type: string; reason: string; issued_by: string
  issued_at: number; expires_at: number | null
}
export type PlayerProfile = {
  uuid: string; username: string; email: string | null
  created_at: number; last_login: number | null; role: string; online: boolean
  isOp?: boolean
  playtime_seconds?: number; playtime_formatted?: string
  balance?: number
  active_sanctions?: ActiveSanction[]
  restrictions?: string[]
  is_banned?: boolean
}

// ── Sections / status portail ────────────────────────────────────────────────
export type FeatureStatus = 'OPERATIONAL' | 'DEGRADED' | 'MAINTENANCE' | 'DISABLED'
export type SectionDetail = {
  key: string; label: string; description: string; icon: string
  enabled: boolean
  status: FeatureStatus
  message: string
  endsAt: number
  updatedAt: number
  updatedBy: string
}
export type PortalSectionsResponse = {
  sections: Record<string, boolean>
  details: SectionDetail[]
}

// ── Maintenance globale du portail ───────────────────────────────────────────
export type GlobalMaintenance = {
  enabled: boolean
  message: string
  endsAt: number
  startedAt: number
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
export type PrestigeResponse = { ok: boolean; reason: string; level?: number; xp?: number; prestige_stars?: number }
export type ActiveTicket = { id: number; type: string; expires_at: number; granted_by: string; granted_at: number }
export type PlayerJobProgress = {
  job_id: string; xp: number; level: number; total_earned: number
  job_name: string; max_level: number; xp_to_next: number
  prestige_stars?: number
}
export type VipPlan = {
  id: string; displayName: string; description?: string | null
  icon?: string | null; color?: string | null
  priceEur: number; durationDays: number; perks?: string[]; order?: number
}

export type CrateShopIcon = {
  material: string | null
  itemAdderId: string | null
}
export type CrateShopEntry = {
  id: string; name: string; displayName: string; description: string | null
  icon: CrateShopIcon; color: string | null
  price: number; priceType: string
}
export type CrateKeyEntry = {
  crateId: string; displayName: string
  icon: CrateShopIcon; color: string | null
  count: number; pendingClaim: boolean
}
export type CrateBuyResult = {
  ok: boolean; crateId: string; count: number
  totalPrice: number; free: boolean; newBalance: number; message: string
}
export type CrateClaimResult = {
  ok: boolean; crateId: string; count: number
  deliveredNow: boolean; message: string
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

  login: (username: string, password: string, captcha?: { id: string; answer: string }) =>
    post<LoginResult>(`${BASE}/register/login`,
      captcha
        ? { username, password, captcha_id: captcha.id, captcha_answer: captcha.answer }
        : { username, password }),

  fetchCaptcha: () => get<CaptchaChallenge>(`${BASE}/captcha`),

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

  jobJoin:    (token: string, jobId: string) =>
    authPost<JoinResponse>('/api/custom-jobs/me/join', token, { jobId }, false),

  jobLeave:   (token: string, jobId: string) =>
    authPost<JoinResponse>('/api/custom-jobs/me/leave', token, { jobId }, false),

  jobPrestige: (token: string, jobId: string) =>
    authPost<PrestigeResponse>('/api/custom-jobs/me/prestige', token, { jobId }, false),

  myTickets: (token: string) =>
    get<ActiveTicket[]>('/api/custom-jobs/me/tickets', token),

  vipPlans: () =>
    get<VipPlan[]>(`${BASE}/vip/plans`),

  dailyClaim: (token: string) =>
    authPost<DailyClaimResult>(`${BASE}/player/me/daily/claim`, token, {}),

  crateShop: () =>
    get<CrateShopEntry[]>(`${BASE}/crates/shop`),

  crateBuy: (token: string, crateId: string, count = 1) =>
    authPost<CrateBuyResult>(`${BASE}/player/me/crates/buy`, token, { crateId, count }),

  crateKeys: (token: string) =>
    get<CrateKeyEntry[]>(`${BASE}/player/me/crates/keys`, token),

  crateClaim: (token: string, crateId: string, count?: number) =>
    authPost<CrateClaimResult>(`${BASE}/player/me/crates/keys/${encodeURIComponent(crateId)}/claim`, token, count != null ? { count } : {}),
}

// ── Social types ──────────────────────────────────────────────────────────────
export type Friend = { uuid: string; username: string; since: number }
export type FriendRequest = {
  id: string; uuid: string; username: string
  sender_uuid: string; receiver_uuid: string; created_at: number
}
export type FriendRelation = 'self' | 'friends' | 'request_sent' | 'request_received' | 'none'
export type FriendRelationResult = {
  relation: FriendRelation; friend_count: number; request_id?: string
}
export type Conversation = {
  id: string; participant1: string; participant2: string
  last_message_at: number; other_uuid: string; other_username: string
  last_msg: string | null; unread: number
}
export type Message = {
  id: string; conversation_id: string; sender_uuid: string
  content: string; read_at: number | null; created_at: number
}
export type ReferralInfo = { code: string; total: number; validated: number }

export function saveToken(token: string) { localStorage.setItem('portal_token', token) }
export function getToken(): string | null  { return localStorage.getItem('portal_token') }
export function clearToken()              {
  localStorage.removeItem('portal_token')
  localStorage.removeItem('portal_restrictions')
}

export function saveRestrictions(keys: string[]) {
  localStorage.setItem('portal_restrictions', JSON.stringify(keys ?? []))
}
export function getRestrictions(): string[] {
  try {
    const raw = localStorage.getItem('portal_restrictions')
    return raw ? JSON.parse(raw) as string[] : []
  } catch { return [] }
}
export function isSectionBlocked(key: string): boolean {
  return getRestrictions().includes(key)
}
