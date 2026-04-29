import React, { useCallback, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { sanctions, revokesSanction } from '../api/client'
import { useApp } from '../context/AppContext'
import { C } from '../theme'

const TYPE_CFG: Record<string, { icon: string; color: string; label: string }> = {
  BAN:  { icon: 'hammer-outline',       color: '#ef4444', label: 'Ban'  },
  MUTE: { icon: 'mic-off-outline',      color: '#f59e0b', label: 'Mute' },
  KICK: { icon: 'arrow-up-outline',     color: '#06b6d4', label: 'Kick' },
  WARN: { icon: 'warning-outline',      color: '#8b5cf6', label: 'Warn' },
}

const FILTERS = ['TOUS', 'BAN', 'MUTE', 'KICK', 'WARN']

export default function SanctionsScreen({ navigation }: any) {
  const { user } = useApp()
  const [items, setItems]     = useState<any[]>([])
  const [filter, setFilter]   = useState('TOUS')
  const [refresh, setRefresh] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await sanctions({ limit: 100 })
      setItems(Array.isArray(data) ? data : [])
    } catch {}
    setLoading(false)
    setRefresh(false)
  }, [])

  useEffect(() => { load() }, [])

  const shown = filter === 'TOUS' ? items : items.filter(s => s.type === filter)

  const doRevoke = (item: any) => {
    Alert.alert(`Révoquer la sanction`, `${item.type} sur ${item.playerName}`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Révoquer', style: 'destructive',
        onPress: async () => {
          try { await revokesSanction(item.id); load() }
          catch (e: any) { Alert.alert('Erreur', e.message) }
        },
      },
    ])
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={C.primary} /></View>

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Sanctions</Text>
        <Text style={s.sub}>{items.length} au total</Text>
      </View>

      {/* Filters */}
      <View style={s.filters}>
        {FILTERS.map(f => {
          const cfg = TYPE_CFG[f]
          const active = filter === f
          return (
            <TouchableOpacity
              key={f}
              style={[s.chip, active && cfg && { backgroundColor: cfg.color + '20', borderColor: cfg.color }
                              , active && !cfg && s.chipActive]}
              onPress={() => setFilter(f)}>
              {cfg && <Ionicons name={cfg.icon as any} size={12} color={active ? cfg.color : C.muted} />}
              <Text style={[s.chipTxt, active && cfg && { color: cfg.color },
                                       active && !cfg && { color: C.primary }]}>{f}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <FlatList
        data={shown}
        keyExtractor={s => s.id ?? String(Math.random())}
        contentContainerStyle={{ padding: 14, gap: 8, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load() }} tintColor={C.primary} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="checkmark-shield-outline" size={40} color={C.success} />
            <Text style={s.emptyTxt}>Aucune sanction</Text>
          </View>}
        renderItem={({ item: sc }) => {
          const cfg = TYPE_CFG[sc.type] ?? TYPE_CFG.WARN
          const active = !sc.revokedAt && (!sc.expiresAt || sc.expiresAt > Date.now())
          return (
            <View style={[s.row, { borderLeftColor: cfg.color }]}>
              <View style={[s.iconWrap, { backgroundColor: cfg.color + '20' }]}>
                <Ionicons name={cfg.icon as any} size={18} color={cfg.color} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TouchableOpacity onPress={() => navigation.navigate('PlayerProfile', { name: sc.playerName })}>
                    <Text style={s.player}>{sc.playerName}</Text>
                  </TouchableOpacity>
                  <View style={[s.badge, { backgroundColor: cfg.color + '20' }]}>
                    <Text style={[s.badgeTxt, { color: cfg.color }]}>{sc.type}</Text>
                  </View>
                  {!active && (
                    <View style={s.revoked}>
                      <Text style={s.revokedTxt}>RÉVOQUÉ</Text>
                    </View>
                  )}
                </View>
                <Text style={s.reason} numberOfLines={2}>{sc.reason}</Text>
                <Text style={s.meta}>
                  Par {sc.staffName ?? sc.staff ?? '?'} · {fmtDate(sc.timestamp)}
                  {sc.durationMs ? ` · ${fmtDuration(sc.durationMs)}` : ' · Permanent'}
                </Text>
              </View>
              {user?.role === 'ADMIN' && active && (
                <TouchableOpacity style={s.revokeBtn} onPress={() => doRevoke(sc)}>
                  <Ionicons name="close-circle-outline" size={20} color={C.danger} />
                </TouchableOpacity>
              )}
            </View>
          )
        }}
      />
    </SafeAreaView>
  )
}

function fmtDate(ts: number) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function fmtDuration(ms: number) {
  const h = Math.floor(ms / 3600000)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}j`
  return `${h}h`
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  center:  { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  header:  { paddingHorizontal: 16, paddingVertical: 12 },
  title:   { fontSize: 22, fontWeight: '800', color: C.text },
  sub:     { fontSize: 13, color: C.muted },
  filters: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, marginBottom: 4, flexWrap: 'wrap' },
  chip:    { flexDirection: 'row', alignItems: 'center', gap: 4,
             paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
             borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  chipActive: { backgroundColor: C.primary + '20', borderColor: C.primary },
  chipTxt:    { fontSize: 12, color: C.muted, fontWeight: '600' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.surface, borderRadius: 12, padding: 12,
    borderLeftWidth: 3, borderColor: C.border,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  player:   { fontSize: 14, fontWeight: '700', color: C.primary },
  badge:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeTxt: { fontSize: 10, fontWeight: '700' },
  revoked:  { backgroundColor: C.muted + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  revokedTxt: { fontSize: 10, color: C.muted, fontWeight: '700' },
  reason:   { fontSize: 12, color: C.text, marginTop: 2 },
  meta:     { fontSize: 11, color: C.muted, marginTop: 4 },
  revokeBtn: { padding: 4 },
  empty:    { alignItems: 'center', padding: 60, gap: 10 },
  emptyTxt: { color: C.muted, fontSize: 14 },
})
