export type Role = 'ADMIN' | 'MOD'

export interface AuthResponse {
  token: string
  username: string
  role: Role
}

export interface ServerStatus {
  tps1m: number
  tps5m: number
  tps15m: number
  playersOnline: number
  playersMax: number
  ramUsedMb: number
  ramMaxMb: number
  uptimeMs: number
  version: string
  worlds: number
}

export interface OnlinePlayer {
  name: string
  uuid: string
  world: string
  ping: number
  gameMode: string
  health: number
  x: number
  y: number
  z: number
}

export interface WorldInfo {
  name: string
  environment: string
  players: number
  loadedChunks: number
  seed: number
  time: number
  pvp: boolean
  difficulty: string
}

export interface AlertEntry {
  timestamp: number
  type: string
  playerName: string
  world: string
  detail: string
}

export interface SanctionEntry {
  id: string
  target: string
  type: string
  reason: string
  staff: string
  timestamp: number
  duration: number
}

export interface ReportEntry {
  id: string
  reporter: string
  target: string
  reason: string
  timestamp: number
  resolved: boolean
}

export interface Transaction {
  id: string
  timestamp: number
  playerUuid: string
  playerName: string
  type: 'BUY' | 'SELL'
  itemMaterial: string
  itemDisplayName: string
  quantity: number
  pricePerUnit: number
  totalPrice: number
  shopName: string
  result: string
}

export interface EconomySummary {
  totalMoney: number
  transactionsToday: number
  volumeToday: number
  economyAvailable: boolean
  topPlayer?: { name: string; balance: number }
}

export interface RichPlayer {
  rank: number
  name: string
  uuid: string
  balance: number
  online: boolean
  lastSeen: number
}

export interface ChartData {
  labels: string[]
  datasets: { label: string; data: number[] }[]
}

export interface TransactionStats {
  totalBuy: number
  totalSell: number
  volumeBuy: number
  volumeSell: number
  topBuyers: { name: string; spent: number; count: number }[]
  topItems: { item: string; quantity: number; revenue: number }[]
}

export interface SecurityConfig {
  killaura_enabled: boolean
  killaura_max_reach: number
  killaura_max_cps: number
  freecam_cancel: boolean
  freecam_max_reach: number
  xray_min_blocks: number
  blocklog_enabled: boolean
  discord_enabled: boolean
  discord_url: string
}

export type WsMessage =
  | { channel: 'console'; data: string }
  | { channel: 'alerts'; data: AlertEntry }
  | { channel: 'stats'; data: ServerStatus }
  | { type: 'auth_ok'; username: string; role: Role }
  | { type: 'subscribed'; channel: string }
  | { type: 'error'; message: string }
