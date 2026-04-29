import React, { useCallback, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, RefreshControl, Modal, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { serverPlayers, kick, sanction } from '../api/client'
import { useApp } from '../context/AppContext'
import { C, S } from '../theme'

const WORLDS_COLORS: Record<string, string> = {
  world: '#10b981', world_nether: '#ef4444', world_the_end: '#8b5cf6',
  spawn: '#f59e0b',
}
function worldColor(w: string) {
  return WORLDS_COLORS[w] ?? C.muted
}

export default function PlayersScreen({ navigation }: any) {
  const { user } = useApp()
  const [players, setPlayers] = useState<any[]>([])
  const [search, setSearch]   = useState('')
  const [refresh, setRefresh] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await serverPlayers()
      setPlayers(Array.isArray(data) ? data : [])
    } catch {}
    setLoading(false)
    setRefresh(false)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [])

  const filtered = players.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.world?.toLowerCase().includes(search.toLowerCase())
  )

  const doKick = async (p: any) => {
    Alert.alert(`Expulser ${p.name}`, 'Confirmer ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Expulser', style: 'destructive',
        onPress: async () => {
          try { await kick(p.name) } catch (e: any) { Alert.alert('Erreur', e.message) }
          setSelected(null)
          load()
        },
      },
    ])
  }

  const doBan = (p: any) => {
    Alert.prompt(
      `Bannir ${p.name}`, 'Raison du ban', [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Bannir', style: 'destructive',
          onPress: async (reason) => {
            if (!reason) return
            try {
              await sanction({ playerName: p.name, type: 'BAN', reason })
            } catch (e: any) { Alert.alert('Erreur', e.message) }
            setSelected(null)
            load()
          },
        },
      ],
      'plain-text', '', 'default'
    )
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={C.primary} /></View>

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Joueurs</Text>
        <View style={[s.count, { backgroundColor: C.primary + '20' }]}>
          <Text style={[s.countTxt, { color: C.primary }]}>{players.length} en ligne</Text>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search" size={16} color={C.muted} style={{ marginRight: 8 }} />
        <TextInput
          style={s.search}
          placeholder="Rechercher un joueur ou monde…"
          placeholderTextColor={C.muted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={C.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={p => p.uuid ?? p.name}
        contentContainerStyle={{ padding: 14, gap: 8, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load() }}
                          tintColor={C.primary} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="people-outline" size={40} color={C.muted} />
            <Text style={s.emptyTxt}>{search ? 'Aucun résultat' : 'Serveur vide'}</Text>
          </View>}
        renderItem={({ item: p }) => (
          <TouchableOpacity style={s.playerCard} onPress={() => setSelected(p)} activeOpacity={0.8}>
            <View style={[s.avatar, { backgroundColor: avatarColor(p.name) }]}>
              <Text style={s.avatarLetter}>{p.name?.[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{p.name}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                <Text style={[s.world, { color: worldColor(p.world) }]}>{p.world}</Text>
                <Text style={s.ping}>🏓 {p.ping}ms</Text>
                <Text style={s.health}>❤ {Math.round(p.health ?? 20)}/20</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.muted} />
          </TouchableOpacity>
        )}
      />

      {/* Player action modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setSelected(null)} />
        {selected && (
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <View style={[s.avatar, { backgroundColor: avatarColor(selected.name), width: 48, height: 48, borderRadius: 14 }]}>
                <Text style={[s.avatarLetter, { fontSize: 20 }]}>{selected.name?.[0]?.toUpperCase()}</Text>
              </View>
              <View>
                <Text style={s.sheetName}>{selected.name}</Text>
                <Text style={s.sheetUuid} numberOfLines={1}>{selected.uuid}</Text>
              </View>
            </View>

            <View style={s.sheetStats}>
              <MiniStat label="Monde" value={selected.world} />
              <MiniStat label="Ping" value={`${selected.ping}ms`} />
              <MiniStat label="Santé" value={`${Math.round(selected.health ?? 20)}/20`} />
              <MiniStat label="Food" value={`${selected.food ?? 20}/20`} />
            </View>

            <View style={s.sheetActions}>
              <ActionBtn
                icon="person-outline" label="Profil"
                color={C.primary}
                onPress={() => { setSelected(null); navigation.navigate('PlayerProfile', { name: selected.name }) }}
              />
              {user?.role === 'ADMIN' && <>
                <ActionBtn icon="exit-outline" label="Expulser" color={C.warning} onPress={() => doKick(selected)} />
                <ActionBtn icon="ban-outline" label="Bannir" color={C.danger} onPress={() => doBan(selected)} />
              </>}
            </View>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{value}</Text>
      <Text style={{ fontSize: 11, color: C.muted }}>{label}</Text>
    </View>
  )
}

function ActionBtn({ icon, label, color, onPress }: any) {
  return (
    <TouchableOpacity style={[s.actionBtn, { backgroundColor: color + '15', borderColor: color + '40' }]} onPress={onPress}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[s.actionTxt, { color }]}>{label}</Text>
    </TouchableOpacity>
  )
}

const COLORS = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#06b6d4']
function avatarColor(name: string) {
  return COLORS[(name?.charCodeAt(0) ?? 0) % COLORS.length]
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 16, paddingVertical: 12 },
  title:  { fontSize: 22, fontWeight: '800', color: C.text },
  count:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  countTxt: { fontSize: 12, fontWeight: '700' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 14, marginBottom: 8,
    backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: C.border,
  },
  search: { flex: 1, color: C.text, fontSize: 14 },
  playerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.surface, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: C.border,
  },
  avatar:       { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontWeight: '800', color: '#fff', fontSize: 16 },
  name:         { fontSize: 15, fontWeight: '700', color: C.text },
  world:        { fontSize: 11, fontWeight: '600' },
  ping:         { fontSize: 11, color: C.muted },
  health:       { fontSize: 11, color: C.danger },
  empty:        { alignItems: 'center', padding: 60, gap: 10 },
  emptyTxt:     { color: C.muted, fontSize: 14 },
  overlay:      { ...StyleSheet.absoluteFillObject, backgroundColor: '#000a' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  sheetName:   { fontSize: 18, fontWeight: '800', color: C.text },
  sheetUuid:   { fontSize: 11, color: C.muted, maxWidth: 220 },
  sheetStats:  { flexDirection: 'row', justifyContent: 'space-around',
                 backgroundColor: C.surface2, borderRadius: 12, padding: 14, marginBottom: 16 },
  sheetActions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1, flexDirection: 'column', alignItems: 'center', gap: 4,
    paddingVertical: 12, borderRadius: 12, borderWidth: 1,
  },
  actionTxt: { fontSize: 12, fontWeight: '700' },
})
