import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { violationsTop } from '../api/client'
import { C, violationColor } from '../theme'

export default function ViolationsScreen({ navigation }: any) {
  const [items, setItems]     = useState<any[]>([])
  const [refresh, setRefresh] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const { offenders } = await violationsTop(50)
      setItems(offenders ?? [])
    } catch {}
    setLoading(false)
    setRefresh(false)
  }, [])

  useEffect(() => { load() }, [])

  if (loading) return <View style={s.center}><ActivityIndicator color={C.primary} /></View>

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Points de violation</Text>
        <Text style={s.sub}>Top 50 joueurs</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={p => p.uuid ?? p.name}
        contentContainerStyle={{ padding: 14, gap: 8, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load() }} tintColor={C.primary} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="checkmark-circle-outline" size={40} color={C.success} />
            <Text style={s.emptyTxt}>Aucune violation enregistrée</Text>
          </View>}
        renderItem={({ item: p, index: i }) => {
          const color = violationColor(p.total)
          const rank = i + 1
          return (
            <TouchableOpacity
              style={[s.row, rank <= 3 && { borderColor: rankBorder(rank) }]}
              onPress={() => navigation.navigate('PlayerProfile', { name: p.name })}
              activeOpacity={0.8}>
              <View style={[s.rankWrap, rank <= 3 && { backgroundColor: rankBorder(rank) + '20' }]}>
                <Text style={[s.rank, rank <= 3 && { color: rankBorder(rank) }]}>
                  {rank <= 3 ? rankEmoji(rank) : `#${rank}`}
                </Text>
              </View>
              <View style={[s.avatar, { backgroundColor: avatarColor(p.name) }]}>
                <Text style={s.avatarL}>{p.name?.[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{p.name}</Text>
                <Text style={s.uuid} numberOfLines={1}>{p.uuid}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.pts, { color }]}>{p.total}</Text>
                <Text style={[s.ptsLabel, { color }]}>pts</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={C.muted} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          )
        }}
      />
    </SafeAreaView>
  )
}

function rankEmoji(r: number) { return r === 1 ? '🥇' : r === 2 ? '🥈' : '🥉' }
function rankBorder(r: number) { return r === 1 ? '#eab308' : r === 2 ? '#94a3b8' : '#b45309' }
const COLORS = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#06b6d4']
function avatarColor(name: string) { return COLORS[(name?.charCodeAt(0) ?? 0) % COLORS.length] }

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  center:  { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  header:  { paddingHorizontal: 16, paddingVertical: 12 },
  title:   { fontSize: 22, fontWeight: '800', color: C.text },
  sub:     { fontSize: 13, color: C.muted },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.surface, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: C.border,
  },
  rankWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rank:     { fontSize: 16, fontWeight: '800', color: C.muted },
  avatar:   { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  avatarL:  { fontWeight: '800', color: '#fff', fontSize: 15 },
  name:     { fontSize: 14, fontWeight: '700', color: C.text },
  uuid:     { fontSize: 10, color: C.muted, maxWidth: 160 },
  pts:      { fontSize: 18, fontWeight: '800' },
  ptsLabel: { fontSize: 10, fontWeight: '700' },
  empty:    { alignItems: 'center', padding: 60, gap: 10 },
  emptyTxt: { color: C.muted, fontSize: 14 },
})
