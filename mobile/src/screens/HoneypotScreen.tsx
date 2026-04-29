import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { honeypotAlerts, honeypotTraps } from '../api/client'
import { C, solidFacesInfo } from '../theme'

export default function HoneypotScreen() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [traps, setTraps]   = useState<any[]>([])
  const [refresh, setRefresh] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [al, tr] = await Promise.all([honeypotAlerts(100), honeypotTraps()])
      setAlerts(Array.isArray(al) ? al.sort((a, b) => b.timestamp - a.timestamp) : [])
      setTraps(Array.isArray(tr) ? tr : [])
    } catch {}
    setLoading(false)
    setRefresh(false)
  }, [])

  useEffect(() => { load() }, [])

  if (loading) return <View style={s.center}><ActivityIndicator color={C.primary} /></View>

  const autoCount = traps.filter(t => t.autoPlaced).length

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Honeypot Anti X-Ray</Text>
          <Text style={s.sub}>{traps.length} pièges actifs · {autoCount} auto</Text>
        </View>
        <View style={s.totalBadge}>
          <Text style={s.totalNum}>{alerts.length}</Text>
          <Text style={s.totalLbl}>triggers</Text>
        </View>
      </View>

      {/* Legend */}
      <View style={s.legend}>
        {([6,5,4,3] as const).map(n => {
          const { label, color } = solidFacesInfo(n)
          return (
            <View key={n} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: color }]} />
              <Text style={s.legendTxt}>{n}/6 · {label}</Text>
            </View>
          )
        })}
      </View>

      <FlatList
        data={alerts}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 14, gap: 8, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load() }} tintColor={C.primary} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 36 }}>🍯</Text>
            <Text style={s.emptyTxt}>Aucun piège déclenché</Text>
            <Text style={s.emptySub}>Les pièges auto se posent lors de l'exploration</Text>
          </View>}
        renderItem={({ item: a }) => {
          const { label, color } = solidFacesInfo(a.solidFaces ?? 0)
          return (
            <View style={[s.row, { borderLeftColor: color }]}>
              <View style={[s.iconWrap, { backgroundColor: color + '20' }]}>
                <Text style={{ fontSize: 18 }}>🍯</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.player}>{a.player}</Text>
                  <View style={[s.badge, { backgroundColor: color + '20' }]}>
                    <Text style={[s.badgeTxt, { color }]}>{label}</Text>
                  </View>
                  {a.autoPlaced && (
                    <View style={s.autoBadge}>
                      <Text style={s.autoBadgeTxt}>AUTO</Text>
                    </View>
                  )}
                </View>
                <Text style={s.loc}>{a.label} @ {a.world} ({a.x},{a.y},{a.z})</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <Text style={[s.faces, { color }]}>{a.solidFaces ?? '?'}/6 faces solides</Text>
                  <Text style={s.meta}>{fmtDate(a.timestamp)}</Text>
                </View>
              </View>
            </View>
          )
        }}
      />
    </SafeAreaView>
  )
}

function fmtDate(ts: number) {
  if (!ts) return ''
  return new Date(ts).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  center:  { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
             paddingHorizontal: 16, paddingVertical: 12 },
  title:   { fontSize: 20, fontWeight: '800', color: C.text },
  sub:     { fontSize: 12, color: C.muted, marginTop: 2 },
  totalBadge: { alignItems: 'center', backgroundColor: C.surface, borderRadius: 12,
                paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.border },
  totalNum:   { fontSize: 22, fontWeight: '800', color: C.primary },
  totalLbl:   { fontSize: 10, color: C.muted },
  legend:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8,
                paddingHorizontal: 14, marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:  { width: 6, height: 6, borderRadius: 3 },
  legendTxt:  { fontSize: 10, color: C.muted, fontWeight: '600' },
  row: {
    flexDirection: 'row', gap: 10,
    backgroundColor: C.surface, borderRadius: 12, padding: 12,
    borderLeftWidth: 3, borderColor: C.border,
  },
  iconWrap:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  player:    { fontSize: 14, fontWeight: '700', color: C.text },
  badge:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeTxt:  { fontSize: 10, fontWeight: '700' },
  autoBadge: { backgroundColor: C.success + '20', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  autoBadgeTxt: { fontSize: 10, fontWeight: '700', color: C.success },
  loc:       { fontSize: 11, color: C.muted, marginTop: 2 },
  faces:     { fontSize: 11, fontWeight: '700' },
  meta:      { fontSize: 11, color: C.muted },
  empty:     { alignItems: 'center', padding: 60, gap: 8 },
  emptyTxt:  { color: C.text, fontSize: 15, fontWeight: '700' },
  emptySub:  { color: C.muted, fontSize: 13, textAlign: 'center' },
})
