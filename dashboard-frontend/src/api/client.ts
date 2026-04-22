import { useAuthStore } from '../stores/authStore'

const API_URL = import.meta.env.VITE_API_URL || ''

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (res.status === 401) {
    useAuthStore.getState().logout()
    throw new Error('Session expirée')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ token: string; username: string; role: string }>('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password }),
    }),
  me: () => request<{ username: string; role: string }>('/api/auth/me'),

  // Server
  serverStatus: () => request<any>('/api/server/status'),
  players:      () => request<any[]>('/api/server/players'),
  worlds:       () => request<any[]>('/api/server/worlds'),
  togglePvp:    (world: string) => request<any>(`/api/server/worlds/${encodeURIComponent(world)}/pvp`, { method: 'POST' }),
  runCommand:   (command: string) => request<any>('/api/server/command', {
    method: 'POST', body: JSON.stringify({ command }),
  }),

  // Security
  alerts:     (limit = 50) => request<any[]>(`/api/security/alerts?limit=${limit}`),
  sanctions:  (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))).toString()
    return request<any>(`/api/security/sanctions?${qs}`)
  },
  createSanction:  (data: any) => request<any>('/api/security/sanctions', { method: 'POST', body: JSON.stringify(data) }),
  revokesSanction: (id: string) => request<any>(`/api/security/sanctions/${id}/revoke`, { method: 'POST' }),
  reports:    (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))).toString()
    return request<any>(`/api/security/reports?${qs}`)
  },
  resolveReport: (id: string) =>
    request<any>(`/api/security/reports/${id}/resolve`, { method: 'POST' }),
  chestscanStatus: () => request<{ running: boolean; lastResult?: any }>('/api/security/chestscan/status'),
  startChestScan:  (worldName: string) => request<any>('/api/security/chestscan/start', {
    method: 'POST', body: JSON.stringify({ worlds: [worldName] }),
  }),
  securityConfig:       () => request<any>('/api/security/config'),
  updateSecurityConfig: (data: any) => request<any>('/api/security/config', { method: 'PUT', body: JSON.stringify(data) }),
  kickPlayer: (uuid: string, reason: string) =>
    request<any>('/api/server/kick', { method: 'POST', body: JSON.stringify({ uuid, reason }) }),
  banPlayer: (uuid: string, reason: string, durationMs?: number) =>
    request<any>('/api/server/ban', { method: 'POST', body: JSON.stringify({ uuid, reason, durationMs }) }),

  // Economy
  economySummary:   () => request<any>('/api/economy/summary'),
  topRich:          (limit = 5) => request<any[]>(`/api/economy/top-rich?limit=${limit}`),
  moneyOverTime:    (days = 7)  => request<any>(`/api/economy/money-over-time?days=${days}`),
  transactions:     (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params as any).toString()
    return request<any>(`/api/economy/transactions?${qs}`)
  },
  transactionStats: (days = 7)  => request<any>(`/api/economy/transactions/stats?days=${days}`),
  exportCsvUrl:     (days = 7, type = '', player = '') =>
    `${API_URL}/api/economy/transactions/export?days=${days}&type=${type}&player=${player}&token=${useAuthStore.getState().token}`,

  // Analytics
  analyticsConnections:  (days = 7) => request<any>(`/api/analytics/connections?days=${days}`),
  analyticsSessionDur:   (days = 7) => request<any>(`/api/analytics/session-duration?days=${days}`),
  analyticsNewPlayers:   (days = 7) => request<any>(`/api/analytics/new-players?days=${days}`),
  analyticsTps:          (days = 7) => request<any>(`/api/analytics/tps?days=${days}`),
  analyticsRam:          (days = 7) => request<any>(`/api/analytics/ram?days=${days}`),
  analyticsAlerts:       (days = 7) => request<any>(`/api/analytics/alerts?days=${days}`),

  // Scheduled Tasks
  tasksList:    () => request<any[]>('/api/tasks'),
  createTask:   (data: any) => request<any>('/api/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask:   (id: string, data: any) => request<any>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTask:   (id: string) => request<any>(`/api/tasks/${id}`, { method: 'DELETE' }),
  runTask:      (id: string) => request<any>(`/api/tasks/${id}/run`, { method: 'POST' }),

  // Plugin Manager
  pluginsList:       () => request<any[]>('/api/plugins'),
  togglePlugin:      (name: string) => request<any>(`/api/plugins/${encodeURIComponent(name)}/toggle`, { method: 'POST' }),
  reloadPlugin:      (name: string) => request<any>(`/api/plugins/${encodeURIComponent(name)}/reload`, { method: 'POST' }),
  reloadPluginCfg:   (name: string) => request<any>(`/api/plugins/${encodeURIComponent(name)}/reloadConfig`, { method: 'POST' }),

  // Config Editor
  configTree:        () => request<any[]>('/api/configs/tree'),
  configRead:        (plugin: string, path: string) =>
    request<any>(`/api/configs/read?plugin=${encodeURIComponent(plugin)}&path=${encodeURIComponent(path)}`),
  configWrite:       (plugin: string, path: string, content: string) =>
    request<any>('/api/configs/write', { method: 'POST', body: JSON.stringify({ plugin, path, content }) }),
  configValidate:    (content: string) =>
    request<any>('/api/configs/validate', { method: 'POST', body: JSON.stringify({ content }) }),
  configHistory:     (plugin: string, path: string) =>
    request<any[]>(`/api/configs/history?plugin=${encodeURIComponent(plugin)}&path=${encodeURIComponent(path)}`),
  configVersion:     (plugin: string, path: string, ts: number) =>
    request<any>(`/api/configs/version?plugin=${encodeURIComponent(plugin)}&path=${encodeURIComponent(path)}&ts=${ts}`),

  // Reboot
  rebootStatus:    () => request<any>('/api/reboot/status'),
  rebootSchedule:  (data: any) => request<any>('/api/reboot/schedule', { method: 'POST', body: JSON.stringify(data) }),
  rebootCancel:    () => request<any>('/api/reboot/cancel', { method: 'POST' }),
  rebootNow:       () => request<any>('/api/reboot/now', { method: 'POST' }),

  // Backups
  backupsList:     () => request<any[]>('/api/backups'),
  backupCreate:    (world: string) => request<any>('/api/backups', { method: 'POST', body: JSON.stringify({ world }) }),
  backupDelete:    (world: string, filename: string) =>
    request<any>(`/api/backups?world=${encodeURIComponent(world)}&filename=${encodeURIComponent(filename)}`, { method: 'DELETE' }),

  // Panic Mode
  panicStatus:     () => request<any>('/api/panic/status'),
  panicActivate:   (reason: string) => request<any>('/api/panic/activate', { method: 'POST', body: JSON.stringify({ reason }) }),
  panicDeactivate: () => request<any>('/api/panic/deactivate', { method: 'POST' }),

  // Honeypot
  honeypotTraps:   () => request<any[]>('/api/honeypot/traps'),
  honeypotCreate:  (data: any) => request<any>('/api/honeypot/traps', { method: 'POST', body: JSON.stringify(data) }),
  honeypotDelete:  (id: string) => request<any>(`/api/honeypot/traps/${id}`, { method: 'DELETE' }),
  honeypotAlerts:  (limit = 100) => request<any[]>(`/api/honeypot/alerts?limit=${limit}`),

  // Toxic Chat
  chatStats:       () => request<any>('/api/chat/stats'),
  chatWordlist:    () => request<{ words: string[] }>('/api/chat/wordlist'),
  chatUpdateWords: (words: string[]) => request<any>('/api/chat/wordlist', { method: 'POST', body: JSON.stringify({ words }) }),
  chatResetPlayer: (player: string) => request<any>('/api/chat/reset', { method: 'POST', body: JSON.stringify({ player }) }),

  // Events
  eventsList:      () => request<{ events: any[] }>('/api/events'),
  eventCreate:     (data: any) => request<any>('/api/events', { method: 'POST', body: JSON.stringify(data) }),
  eventUpdate:     (id: string, data: any) => request<any>(`/api/events/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  eventDelete:     (id: string) => request<any>(`/api/events/${id}`, { method: 'DELETE' }),
  eventsExportUrl: () => `${API_URL}/api/events/export?token=${useAuthStore.getState().token}`,

  // Quests
  questsList:      () => request<{ quests: any[] }>('/api/quests'),
  questCreate:     (data: any) => request<any>('/api/quests', { method: 'POST', body: JSON.stringify(data) }),
  questUpdate:     (id: string, data: any) => request<any>(`/api/quests/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  questDelete:     (id: string) => request<any>(`/api/quests/${id}`, { method: 'DELETE' }),

  // Experiments (A/B testing)
  experimentsList:  () => request<{ experiments: any[] }>('/api/experiments'),
  experimentCreate: (data: any) => request<any>('/api/experiments', { method: 'POST', body: JSON.stringify(data) }),
  experimentUpdate: (id: string, data: any) => request<any>(`/api/experiments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  experimentDelete: (id: string) => request<any>(`/api/experiments/${id}`, { method: 'DELETE' }),

  // Users / Accounts
  usersList:          () => request<{ users: any[] }>('/api/users'),
  userCreate:         (data: { username: string; password: string; role: string }) =>
    request<any>('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  userChangeRole:     (username: string, role: string) =>
    request<any>(`/api/users/${encodeURIComponent(username)}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  userResetPassword:  (username: string, newPassword: string) =>
    request<any>(`/api/users/${encodeURIComponent(username)}/password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),
  userDelete:         (username: string) =>
    request<any>(`/api/users/${encodeURIComponent(username)}`, { method: 'DELETE' }),
  userChangeOwnPassword: (currentPassword: string, newPassword: string) =>
    request<any>('/api/users/me/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),

  // Permissions matrix
  permsGet:        () => request<{
    roles: Record<string, string[]>
    catalog: Array<{ id: string; label: string; description: string; category: string }>
  }>('/api/permissions'),
  permsUpdate:     (role: string, permissions: string[]) =>
    request<any>('/api/permissions', { method: 'PUT', body: JSON.stringify({ role, permissions }) }),
  permsReset:      () => request<any>('/api/permissions/reset', { method: 'POST' }),

  // AI Assistant
  aiStatus:        () => request<{
    configured: boolean
    model: string
    provider: string
    availableModels: Array<{id: string; name: string; desc: string; tier: string}>
    availableProviders: Array<{id: string; name: string; keyUrl: string}>
  }>('/api/ai/status'),
  aiChat:          (messages: Array<{ role: string; content: string }>) =>
    request<any>('/api/ai/chat', { method: 'POST', body: JSON.stringify({ messages }) }),
  aiSetConfig:     (data: { model?: string; apiKey?: string; provider?: string }) =>
    request<any>('/api/ai/config', { method: 'POST', body: JSON.stringify(data) }),
  aiDiagnose:      (focus: 'full' | 'tps' | 'ram' | 'plugins' = 'full') =>
    request<{ analysis: string; context: string; model: string; timestamp: number }>(
      '/api/ai/diagnose', { method: 'POST', body: JSON.stringify({ focus }) }
    ),
  aiApplyPatch:    (file: string, changes: Array<{ path: string; value: any }>) =>
    request<any>('/api/ai/apply-patch', { method: 'POST', body: JSON.stringify({ file, changes }) }),
  aiUsage:         () => request<{
    today: { date: string; inputTokens: number; outputTokens: number; requests: number; costUsd: number }
    allTime: { inputTokens: number; outputTokens: number; requests: number; costUsd: number }
    last7Days: Array<{ date: string; inputTokens: number; outputTokens: number; requests: number; costUsd: number }>
    pricing: Record<string, number[]>
    usdToEur: number
  }>('/api/ai/usage'),

  // Crates / Lootboxes
  cratesList:      () => request<any[]>('/api/crates'),
  crateGet:        (id: string) => request<any>(`/api/crates/${id}`),
  crateCreate:     (data: any) => request<any>('/api/crates', { method: 'POST', body: JSON.stringify(data) }),
  crateUpdate:     (id: string, data: any) => request<any>(`/api/crates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  crateDelete:     (id: string) => request<any>(`/api/crates/${id}`, { method: 'DELETE' }),
  crateOpens:      (id: string, limit = 50) => request<any[]>(`/api/crates/${id}/opens?limit=${limit}`),
  crateAllOpens:   (limit = 100) => request<any[]>(`/api/crates/opens?limit=${limit}`),
  crateStats:      (id: string) => request<any>(`/api/crates/${id}/stats`),
  crateGiveKey:    (id: string, playerName: string, count: number) =>
    request<any>(`/api/crates/${id}/key/give`, { method: 'POST', body: JSON.stringify({ playerName, count }) }),
  cratePlayerKeys: (playerName: string) => request<any>(`/api/crates/keys/${encodeURIComponent(playerName)}`),
  cratesPlaced:    () => request<any[]>('/api/crates/placed'),

  // Daily Rewards
  dailyConfig:     () => request<any>('/api/daily/config'),
  dailySaveConfig: (cfg: any) => request<any>('/api/daily/config', { method: 'PUT', body: JSON.stringify(cfg) }),
  dailyClaims:     (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))).toString()
    return request<any[]>(`/api/daily/claims${qs ? '?' + qs : ''}`)
  },
  dailyStats:      (days = 7) => request<any>(`/api/daily/stats?days=${days}`),
  dailyStreak:     (playerName: string) => request<any>(`/api/daily/streak/${encodeURIComponent(playerName)}`),
  dailyReset:      (playerName: string) => request<any>(`/api/daily/reset/${encodeURIComponent(playerName)}`, { method: 'POST' }),

  // Announcements
  annList:         () => request<any[]>('/api/announcements'),
  annGet:          (id: string) => request<any>(`/api/announcements/${id}`),
  annCreate:       (data: any) => request<any>('/api/announcements', { method: 'POST', body: JSON.stringify(data) }),
  annUpdate:       (id: string, data: any) => request<any>(`/api/announcements/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  annDelete:       (id: string) => request<any>(`/api/announcements/${id}`, { method: 'DELETE' }),
  annTestSend:     (id: string) => request<any>(`/api/announcements/${id}/test-send`, { method: 'POST' }),
  annStats:        () => request<any>('/api/announcements/stats'),

  // LuckPerms
  lpStatus:        () => request<{ available: boolean; version: string | null }>('/api/luckperms/status'),
  lpGroups:        () => request<any[]>('/api/luckperms/groups'),
  lpPlayer:        (playerName: string) => request<any>(`/api/luckperms/player/${encodeURIComponent(playerName)}`),
  lpAddGroup:      (playerName: string, group: string) =>
    request<any>(`/api/luckperms/player/${encodeURIComponent(playerName)}/group`, { method: 'POST', body: JSON.stringify({ group }) }),
  lpRemoveGroup:   (playerName: string, group: string) =>
    request<any>(`/api/luckperms/player/${encodeURIComponent(playerName)}/group/${encodeURIComponent(group)}`, { method: 'DELETE' }),
  lpSetPrimary:    (playerName: string, group: string) =>
    request<any>(`/api/luckperms/player/${encodeURIComponent(playerName)}/primary`, { method: 'PUT', body: JSON.stringify({ group }) }),
  lpOnline:        () => request<any[]>('/api/luckperms/online'),

  // Shops (EconomyShopGUI sync)
  shopsList:       () => request<any[]>('/api/shops'),
  shopGet:         (id: string) => request<any>(`/api/shops/${id}`),
  shopCreate:      (data: any) => request<any>('/api/shops', { method: 'POST', body: JSON.stringify(data) }),
  shopUpdate:      (id: string, data: any) => request<any>(`/api/shops/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  shopDelete:      (id: string) => request<any>(`/api/shops/${id}`, { method: 'DELETE' }),
  shopAddItem:     (shopId: string, item: any) =>
    request<any>(`/api/shops/${shopId}/items`, { method: 'POST', body: JSON.stringify(item) }),
  shopUpdateItem:  (shopId: string, itemId: string, item: any) =>
    request<any>(`/api/shops/${shopId}/items/${itemId}`, { method: 'PUT', body: JSON.stringify(item) }),
  shopRemoveItem:  (shopId: string, itemId: string) =>
    request<any>(`/api/shops/${shopId}/items/${itemId}`, { method: 'DELETE' }),
  shopSync:        () => request<any>('/api/shops/sync', { method: 'POST' }),
  shopRollback:    () => request<any>('/api/shops/rollback', { method: 'POST' }),
  shopImportESG:   () => request<any[]>('/api/shops/import-esg', { method: 'POST' }),
  shopEsgStatus:   () => request<any>('/api/shops/esg-status'),
  shopTransactions:(shopId: string, params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))).toString()
    return request<any[]>(`/api/shops/${shopId}/transactions${qs ? '?' + qs : ''}`)
  },
  shopStats:       (shopId: string, days = 7) => request<any>(`/api/shops/${shopId}/stats?days=${days}`),
  shopsGlobalStats:(days = 7) => request<any>(`/api/shops/stats?days=${days}`),

  // VIP / Subscriptions (admin)
  vipPlans:        () => request<any[]>('/api/vip/plans'),
  vipCreatePlan:   (data: any) => request<any>('/api/vip/plans', { method: 'POST', body: JSON.stringify(data) }),
  vipUpdatePlan:   (id: string, data: any) => request<any>(`/api/vip/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  vipDeletePlan:   (id: string) => request<any>(`/api/vip/plans/${id}`, { method: 'DELETE' }),
  vipSubscriptions:(params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))).toString()
    return request<any[]>(`/api/vip/subscriptions${qs ? '?' + qs : ''}`)
  },
  vipGetSubscription: (id: string) => request<any>(`/api/vip/subscriptions/${id}`),
  vipExtend:       (id: string, days: number) =>
    request<any>(`/api/vip/subscriptions/${id}/extend`, { method: 'POST', body: JSON.stringify({ days }) }),
  vipRevoke:       (id: string, reason: string) =>
    request<any>(`/api/vip/subscriptions/${id}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) }),
  vipGift:         (playerName: string, planId: string) =>
    request<any>('/api/vip/gift', { method: 'POST', body: JSON.stringify({ playerName, planId }) }),
  vipTransactions: (days = 30, limit = 200) => request<any[]>(`/api/vip/transactions?days=${days}&limit=${limit}`),
  vipStats:        (days = 30) => request<any>(`/api/vip/stats?days=${days}`),
  vipGateways:     () => request<any>('/api/vip/gateways/status'),

  // VIP — endpoints publics (pas d'auth, pour la page /buy)
  vipPublicPlans:  () => fetch('/api/public/vip/plans').then(r => r.json()) as Promise<any[]>,
  vipPublicCheckout: (planId: string, playerName: string, gateway: 'STRIPE' | 'PAYPAL') =>
    fetch('/api/public/vip/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId, playerName, gateway }),
    }).then(async r => {
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || r.statusText)
      return data as { redirectUrl: string }
    }),
}
