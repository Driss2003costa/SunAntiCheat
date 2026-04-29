import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useNavigation } from '@react-navigation/native'
import {
  serverStatus, serverPlayers, securityAlerts,
  panicStatus, panicActivate, panicDeactivate,
} from '../api/client'
import { WsClient } from '../api/ws'
import { useApp } from '../context/AppContext'
import { C, tpsColor, S } from '../theme'

interface Stat { tps: number; playersOnline: number; maxPlayers: number; ram: number; ramMax: number; uptime: number; version: string }

export default function HomeScreen() {
  const { jwt, serverUrl, user } = useApp()
  const nav = useNavigation<any>()
  const [stat, setStat]     = useState<Stat | null>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [panic, setPanic]   = useState<{ active: boolean; reason?: string } | null>(null)
  const [refresh, setRefresh] = useState(false)
  const [loading, setLoading] = useState(true)
  const wsRef = useRef<WsClient | null>(null)

  const load = useCallback(async () => {
    try {
      const [status, al, pk] = await Promise.all([
        serverStatus(),
        securityAlerts(5),
        panicStatus().catch(() => null),
      ])
      setStat(status)
      setAlerts(al)
      setPanic(pk)
    } catch {}
    setLoading(false)
    setRefresh(false)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 15_000)

    // WebSocket stats channel
    if (jwt && jwt !== '__existing__') {
      const ws = new WsClient(jwt)
      wsRef.current = ws
      ws.connect()
      ws.subscribe('stats', (data) => {
        setStat(s => s ? { ...s, ...data } : data)
      })
    }

    return () => {
      clearInterval(t)
      wsRef.current?.disconnect()
    }
  }, [])

  const togglePanic = async () => {
    if (!panic) return
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    if (panic.active) {
      await panicDeactivate()
    } else {
      await panicActivate('Mode panique activé depuis mobile')
    }
    setPanic(p => p ? { ...p, active: !p.active } : p)
  }

  const host = (() => { try { return new URL(serverUrl).host } catch { return serverUrl } })()

  if (loading) return (
    <View style={s.center}><ActivityIndicator color={C.primary} size="large" /></View>
  )

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load() }}
                                        tintColor={C.primary} />}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.hSub}>Connecté à</Text>
            <Text style={s.hUrl} numberOfLines={1}>{host}</Text>
          </View>
          <View style={s.pillRow}>
            <View style={[s.pill, { backgroundColor: C.success + '20' }]}>
              <View style={[s.dot, { backgroundColor: C.success }]} />
              <Text style={[s.pillTxt, { color: C.success }]}>En ligne</Text>
            </View>
            {user?.role === 'ADMIN' && (
              <View style={[s.pill, { backgroundColor: C.primary + '20' }]}>
                <Text style={[s.pillTxt, { color: C.primary }]}>ADMIN</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats row */}
        {stat && (
          <View style={s.statsRow}>
            <StatBox
              icon="speedometer-outline" label="TPS"
              value={stat.tps?.toFixed(1) ?? '—'}
              color={tpsColor(stat.tps ?? 0)} />
            <StatBox
              icon="people-outline" label="Joueurs"
              value={`${stat.playersOnline ?? 0}/${stat.maxPlayers ?? '?'}`}
              color={C.primary} />
            <StatBox
              icon="hardware-chip-outline" label="RAM"
              value={`${Math.round(stat.ram ?? 0)}M`}
              color={C.warning} />
          </View>
        )}

        {stat && (
          <View style={s.card}>
            <Text style={s.cardLabel}>SERVEUR</Text>
            <View style={s.infoGrid}>
              <InfoRow icon="cube-outline" label="Version" value={stat.version ?? '—'} />
              <InfoRow icon="time-outline" label="Uptime" value={fmtUptime(stat.uptime ?? 0)} />
              <InfoRow icon="server-outline" label="RAM max" value={`${Math.round(stat.ramMax ?? 0)} Mo`} />
            </View>
          </View>
        )}

        {/* Panic mode */}
        {panic && (
          <TouchableOpacity
            style={[s.panicCard, panic.active && s.panicActive]}
            onPress={togglePanic}
            activeOpacity={0.85}>
            <Ionicons
              name={panic.active ? 'warning' : 'warning-outline'}
              size={22} color={panic.active ? '#fff' : C.danger} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[s.panicTitle, panic.active && { color: '#fff' }]}>
                {panic.active ? '⚡ MODE PANIQUE ACTIF' : 'Mode Panique'}
              </Text>
              <Text style={[s.panicSub, panic.active && { color: '#fff9' }]}>
                {panic.active ? panic.reason ?? 'Actif' : 'Toucher pour activer'}
              </Text>
            </View>
            <Ionicons
              name={panic.active ? 'close-circle' : 'power'}
              size={22} color={panic.active ? '#fff' : C.danger} />
          </TouchableOpacity>
        )}

        {/* Recent alerts */}
        <View style={s.card}>
          <View style={[S.row, { justifyContent: 'space-between', marginBottom: 10 }]}>
            <Text style={s.cardLabel}>ALERTES RÉCENTES</Text>
            <TouchableOpacity onPress={() => nav.navigate('Alerts')}>
              <Text style={{ fontSize: 12, color: C.primary }}>Voir tout →</Text>
            </TouchableOpacity>
          </View>
          {alerts.length === 0
            ? <Text style={{ color: C.muted, fontSize: 13 }}>Aucune alerte récente</Text>
            : alerts.slice(0, 5).map((a, i) => <AlertRow key={i} alert={a} />)}
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

function StatBox({ icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <View style={s.statBox}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[s.statVal, { color }]}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  )
}

function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Ionicons name={icon} size={14} color={C.muted} />
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  )
}

function AlertRow({ alert: a }: { alert: any }) {
  const color = alertColor(a.type)
  return (
    <View style={[s.alertRow, { borderLeftColor: color }]}>
      <View style={[s.alertBadge, { backgroundColor: color + '25' }]}>
        <Text style={[s.alertType, { color }]}>{a.type}</Text>
      </View>
      <Text style={s.alertPlayer} numberOfLines={1}>{a.player}</Text>
      <Text style={s.alertTime}>{fmtAgo(a.timestamp)}</Text>
    </View>
  )
}

function alertColor(type: string) {
  const t = (type ?? '').toUpperCase()
  if (t.includes('XRAY'))     return C.warning
  if (t.includes('KILLAURA')) return C.danger
  if (t.includes('HONEYPOT')) return '#dc2626'
  if (t.includes('FREECAM'))  return C.orange
  return C.muted
}

function fmtUptime(ms: number) {
  const h = Math.floor(ms / 3600000)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}j ${h % 24}h`
  return `${h}h`
}

function fmtAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60)    return `${s}s`
  if (s < 3600)  return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}j`
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  center:  { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  scroll:  { padding: 16, gap: 12 },

  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  hSub:    { fontSize: 11, color: C.muted },
  hUrl:    { fontSize: 16, fontWeight: '700', color: C.text, maxWidth: 200 },
  pillRow: { flexDirection: 'row', gap: 6 },
  pill:    { flexDirection: 'row', alignItems: 'center', borderRadius: 20,
             paddingHorizontal: 8, paddingVertical: 4, gap: 4 },
  dot:     { width: 6, height: 6, borderRadius: 3 },
  pillTxt: { fontSize: 11, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 10 },
  statBox:  {
    flex: 1, backgroundColor: C.surface, borderRadius: 14,
    padding: 14, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: C.border,
  },
  statVal:  { fontSize: 20, fontWeight: '800' },
  statLbl:  { fontSize: 10, color: C.muted, fontWeight: '600' },

  card:       { backgroundColor: C.surface, borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: C.border },
  cardLabel:  { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1 },
  infoGrid:   { marginTop: 8, gap: 8 },
  infoRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel:  { fontSize: 13, color: C.muted, width: 70 },
  infoValue:  { fontSize: 13, color: C.text, fontWeight: '600', flex: 1 },

  panicCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.danger + '50',
  },
  panicActive: { backgroundColor: C.danger, borderColor: C.danger },
  panicTitle:  { fontWeight: '700', fontSize: 14, color: C.danger },
  panicSub:    { fontSize: 12, color: C.muted, marginTop: 2 },

  alertRow:  {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingLeft: 8, borderLeftWidth: 2, marginBottom: 8,
  },
  alertBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  alertType:  { fontSize: 10, fontWeight: '700' },
  alertPlayer: { flex: 1, fontSize: 13, color: C.text, fontWeight: '600' },
  alertTime:  { fontSize: 11, color: C.muted },
})
