import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { securityAlerts } from '../api/client'
import { WsClient } from '../api/ws'
import { useApp } from '../context/AppContext'
import { C } from '../theme'

const ALERT_ICONS: Record<string, { icon: string; color: string }> = {
  XRAY:             { icon: 'eye-outline',          color: '#eab308' },
  KILLAURA:         { icon: 'skull-outline',         color: '#ef4444' },
  HONEYPOT:         { icon: 'bug-outline',           color: '#dc2626' },
  FREECAM:          { icon: 'videocam-outline',      color: '#f97316' },
  'INVENTORY-ANOMALY': { icon: 'cube-outline',       color: '#8b5cf6' },
  'ALT-BAN':        { icon: 'people-circle-outline', color: '#ec4899' },
  JOBS:             { icon: 'briefcase-outline',     color: '#06b6d4' },
}

function typeInfo(type: string) {
  const t = type?.toUpperCase() ?? ''
  for (const [key, val] of Object.entries(ALERT_ICONS)) {
    if (t.includes(key)) return val
  }
  return { icon: 'alert-circle-outline', color: C.muted }
}

export default function AlertsScreen() {
  const { jwt } = useApp()
  const [items, setItems]     = useState<any[]>([])
  const [filter, setFilter]   = useState<string | null>(null)
  const [refresh, setRefresh] = useState(false)
  const wsRef = useRef<WsClient | null>(null)
  const listRef = useRef<FlatList>(null)

  const load = async () => {
    try {
      const data = await securityAlerts(100)
      setItems(data.sort((a: any, b: any) => b.timestamp - a.timestamp))
    } catch {}
    setRefresh(false)
  }

  useEffect(() => {
    load()

    if (!jwt || jwt === '__existing__') return
    const ws = new WsClient(jwt)
    wsRef.current = ws
    ws.connect()
    ws.subscribe('alerts', (data) => {
      setItems(prev => [{ ...data, timestamp: Date.now() }, ...prev].slice(0, 200))
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    })
    return () => ws.disconnect()
  }, [])

  const types = ['XRAY', 'KILLAURA', 'HONEYPOT', 'FREECAM']
  const shown = filter
    ? items.filter(a => a.type?.toUpperCase().includes(filter))
    : items

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Alertes</Text>
        <View style={[s.wsIndicator, { backgroundColor: wsRef.current?.connected ? C.success : C.danger }]} />
      </View>

      {/* Filter chips */}
      <View style={s.filters}>
        <TouchableOpacity
          style={[s.chip, !filter && s.chipActive]}
          onPress={() => setFilter(null)}>
          <Text style={[s.chipTxt, !filter && s.chipTxtActive]}>Tous</Text>
        </TouchableOpacity>
        {types.map(t => {
          const info = typeInfo(t)
          const active = filter === t
          return (
            <TouchableOpacity
              key={t}
              style={[s.chip, active && { backgroundColor: info.color + '25', borderColor: info.color }]}
              onPress={() => setFilter(filter === t ? null : t)}>
              <Text style={[s.chipTxt, active && { color: info.color }]}>{t}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <FlatList
        ref={listRef}
        data={shown}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 14, gap: 8, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load() }}
                          tintColor={C.primary} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="checkmark-circle-outline" size={40} color={C.success} />
            <Text style={s.emptyTxt}>Aucune alerte</Text>
          </View>}
        renderItem={({ item: a }) => <AlertItem a={a} />}
      />
    </SafeAreaView>
  )
}

function AlertItem({ a }: { a: any }) {
  const { icon, color } = typeInfo(a.type)
  return (
    <View style={[s.item, { borderLeftColor: color }]}>
      <View style={[s.iconWrap, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[s.badge, { color, backgroundColor: color + '18' }]}>{a.type}</Text>
          <Text style={s.player} numberOfLines={1}>{a.player}</Text>
        </View>
        {a.detail ? <Text style={s.detail} numberOfLines={2}>{a.detail}</Text> : null}
        <Text style={s.meta}>{a.world} · {fmtDate(a.timestamp)}</Text>
      </View>
    </View>
  )
}

function fmtDate(ts: number) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
             paddingHorizontal: 16, paddingVertical: 12 },
  title:   { fontSize: 22, fontWeight: '800', color: C.text },
  wsIndicator: { width: 8, height: 8, borderRadius: 4 },

  filters: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, marginBottom: 4, flexWrap: 'wrap' },
  chip:    { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
             borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  chipActive: { backgroundColor: C.primary + '25', borderColor: C.primary },
  chipTxt:    { fontSize: 12, color: C.muted, fontWeight: '600' },
  chipTxtActive: { color: C.primary },

  item: {
    flexDirection: 'row', gap: 12,
    backgroundColor: C.surface, borderRadius: 12, padding: 12,
    borderLeftWidth: 3, borderColor: C.border,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badge:    { fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  player:   { fontSize: 14, fontWeight: '700', color: C.text, flex: 1 },
  detail:   { fontSize: 12, color: C.muted, marginTop: 2 },
  meta:     { fontSize: 11, color: C.muted, marginTop: 4 },

  empty:    { alignItems: 'center', justifyContent: 'center', padding: 60, gap: 10 },
  emptyTxt: { fontSize: 15, color: C.muted },
})
