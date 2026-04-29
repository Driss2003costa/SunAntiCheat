import React, { useCallback, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { playerProfile, resetViolations } from '../api/client'
import { useApp } from '../context/AppContext'
import { C, violationColor } from '../theme'

export default function PlayerProfileScreen({ route }: any) {
  const { name } = route.params
  const { user } = useApp()
  const [profile, setProfile] = useState<any>(null)
  const [tab, setTab]         = useState<'overview' | 'sanctions' | 'alts'>('overview')
  const [refresh, setRefresh] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try { setProfile(await playerProfile(name)) } catch {}
    setLoading(false)
    setRefresh(false)
  }, [name])

  useEffect(() => { load() }, [name])

  if (loading) return <View style={s.center}><ActivityIndicator color={C.primary} size="large" /></View>
  if (!profile) return (
    <View style={s.center}>
      <Ionicons name="person-remove-outline" size={40} color={C.muted} />
      <Text style={{ color: C.muted, marginTop: 8 }}>Joueur introuvable</Text>
    </View>
  )

  const id        = profile.identity ?? {}
  const sanctions = profile.sanctions ?? []
  const alts      = profile.alts ?? []
  const vp        = profile.violationPoints ?? { total: 0, events: [] }
  const vpColor   = violationColor(vp.total)

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load() }} tintColor={C.primary} />}>

        {/* Hero */}
        <View style={s.hero}>
          <View style={[s.avatar, { backgroundColor: avatarColor(id.name ?? name) }]}>
            <Text style={s.avatarL}>{(id.name ?? name)?.[0]?.toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.nameRow}>
              <Text style={s.name}>{id.name ?? name}</Text>
              {id.banned && (
                <View style={s.bannedBadge}>
                  <Text style={s.bannedTxt}>BANNI</Text>
                </View>
              )}
            </View>
            <View style={[s.onlineDot, { backgroundColor: id.online ? C.success : C.muted }]}>
              <Text style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>
                {id.online ? '● EN LIGNE' : '○ HORS-LIGNE'}
              </Text>
            </View>
            <Text style={s.uuid} numberOfLines={1} selectable>{id.uuid}</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          <StatCard icon="shield-half-outline" label="Sanctions" value={String(sanctions.length)} color={C.warning} />
          <StatCard icon="warning-outline" label="Violations" value={String(vp.total)} color={vpColor} />
          <StatCard icon="people-circle-outline" label="Alts" value={String(alts.length)} color={C.primary} />
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          {(['overview','sanctions','alts'] as const).map(t => (
            <TouchableOpacity
              key={t} style={[s.tab, tab === t && s.tabActive]}
              onPress={() => setTab(t)}>
              <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
                {t === 'overview' ? 'Aperçu' : t === 'sanctions' ? 'Sanctions' : 'Alts'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ paddingHorizontal: 14 }}>

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <View style={{ gap: 10 }}>
              {/* Violation points */}
              <View style={s.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={s.cardLabel}>POINTS DE VIOLATION</Text>
                  {user?.role === 'ADMIN' && vp.total > 0 && (
                    <TouchableOpacity
                      onPress={() => Alert.alert('Réinitialiser ?', 'Remettre les points à 0 ?', [
                        { text: 'Annuler', style: 'cancel' },
                        { text: 'Reset', style: 'destructive', onPress: async () => {
                          try { await resetViolations(id.uuid); load() } catch (e: any) { Alert.alert('Erreur', e.message) }
                        }},
                      ])}
                      style={s.resetBtn}>
                      <Text style={s.resetTxt}>Reset</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={[s.bigNum, { color: vpColor }]}>{vp.total}</Text>
                <Text style={[s.bigLbl, { color: vpColor }]}>
                  {vp.total >= 100 ? 'Critique' : vp.total >= 50 ? 'Dangereux' : vp.total >= 20 ? 'Suspect' : 'Propre'}
                </Text>
                {(vp.events ?? []).slice(0, 5).map((ev: any, i: number) => (
                  <View key={i} style={s.evRow}>
                    <Text style={[s.evType, { backgroundColor: C.warning + '20', color: C.warning }]}>{ev.checkType}</Text>
                    <Text style={s.evPts}>+{ev.ptsAdded} pts</Text>
                    <Text style={s.evTotal}>→ {ev.totalAfter}</Text>
                    <Text style={s.evDate}>{fmtDate(ev.ts)}</Text>
                  </View>
                ))}
              </View>

              {/* Identity */}
              <View style={s.card}>
                <Text style={s.cardLabel}>IDENTITÉ</Text>
                <View style={{ gap: 8, marginTop: 8 }}>
                  {id.online && <>
                    <InfoRow icon="earth-outline" label="Monde" value={id.world} />
                    <InfoRow icon="heart-outline" label="Santé" value={`${Math.round(id.health ?? 0)}/20`} />
                    <InfoRow icon="location-outline" label="Position" value={`${id.x}, ${id.y}, ${id.z}`} />
                    <InfoRow icon="wifi-outline" label="Ping" value={`${id.ping}ms`} />
                  </>}
                  {!id.online && <>
                    <InfoRow icon="time-outline" label="Dernière co." value={fmtDate(id.lastPlayed)} />
                    <InfoRow icon="calendar-outline" label="Première co." value={fmtDate(id.firstPlayed)} />
                  </>}
                </View>
              </View>
            </View>
          )}

          {/* SANCTIONS */}
          {tab === 'sanctions' && (
            <View style={{ gap: 8 }}>
              {sanctions.length === 0
                ? <View style={s.emptyCard}><Ionicons name="checkmark-circle-outline" size={28} color={C.success} /><Text style={s.emptyTxt}>Aucune sanction</Text></View>
                : sanctions.map((sc: any, i: number) => (
                  <View key={i} style={[s.scRow, { borderLeftColor: typeColor(sc.type) }]}>
                    <Text style={[s.scType, { color: typeColor(sc.type) }]}>{sc.type}</Text>
                    <Text style={s.scReason}>{sc.reason}</Text>
                    <Text style={s.scMeta}>Par {sc.staff ?? sc.staffName} · {fmtDate(sc.timestamp)}</Text>
                  </View>
                ))}
            </View>
          )}

          {/* ALTS */}
          {tab === 'alts' && (
            <View style={{ gap: 8 }}>
              {alts.length === 0
                ? <View style={s.emptyCard}><Ionicons name="checkmark-circle-outline" size={28} color={C.success} /><Text style={s.emptyTxt}>Aucun compte lié</Text></View>
                : alts.map((a: any, i: number) => (
                  <View key={i} style={[s.altRow, a.banned && { borderColor: C.danger + '50' }]}>
                    <Text style={{ fontSize: 18 }}>{a.banned ? '🔨' : '👤'}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <Text style={[s.altName, a.banned && { color: C.danger }]}>{a.name}</Text>
                        {a.banned && <View style={s.bannedBadge}><Text style={s.bannedTxt}>BANNI</Text></View>}
                      </View>
                      <Text style={s.altMeta}>IP: {a.ip}</Text>
                    </View>
                  </View>
                ))}
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function StatCard({ icon, label, value, color }: any) {
  return (
    <View style={s.statCard}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[s.statVal, { color }]}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  )
}

function InfoRow({ icon, label, value }: any) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Ionicons name={icon} size={14} color={C.muted} />
      <Text style={{ fontSize: 13, color: C.muted, width: 80 }}>{label}</Text>
      <Text style={{ fontSize: 13, color: C.text, fontWeight: '600', flex: 1 }} numberOfLines={1}>{value}</Text>
    </View>
  )
}

function typeColor(t: string) {
  if (t === 'BAN')  return C.danger
  if (t === 'MUTE') return C.warning
  if (t === 'KICK') return C.primary
  return C.muted
}

function fmtDate(ts: number) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const COLORS = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#06b6d4']
function avatarColor(name: string) { return COLORS[(name?.charCodeAt(0) ?? 0) % COLORS.length] }

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: C.bg },
  center:   { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 8 },
  hero:     { flexDirection: 'row', gap: 14, padding: 16, paddingBottom: 8 },
  avatar:   { width: 60, height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarL:  { fontWeight: '800', color: '#fff', fontSize: 24 },
  nameRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name:     { fontSize: 20, fontWeight: '800', color: C.text },
  bannedBadge: { backgroundColor: C.danger + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  bannedTxt:   { fontSize: 9, fontWeight: '800', color: C.danger },
  onlineDot:   { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 4 },
  uuid:     { fontSize: 10, color: C.muted, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginBottom: 4 },
  statCard: { flex: 1, backgroundColor: C.surface, borderRadius: 12, padding: 12,
              alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.border },
  statVal:  { fontSize: 18, fontWeight: '800' },
  statLbl:  { fontSize: 10, color: C.muted, fontWeight: '600' },
  tabs:     { flexDirection: 'row', paddingHorizontal: 14, gap: 4, marginBottom: 12,
              borderBottomWidth: 1, borderColor: C.border },
  tab:      { paddingHorizontal: 14, paddingVertical: 10 },
  tabActive: { borderBottomWidth: 2, borderColor: C.primary },
  tabTxt:    { fontSize: 14, color: C.muted, fontWeight: '600' },
  tabTxtActive: { color: C.primary },
  card:     { backgroundColor: C.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border },
  cardLabel: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1 },
  bigNum:   { fontSize: 36, fontWeight: '800', marginTop: 6 },
  bigLbl:   { fontSize: 12, fontWeight: '700', marginBottom: 10 },
  evRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4,
              borderTopWidth: 1, borderColor: C.border },
  evType:   { fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  evPts:    { fontSize: 12, fontWeight: '700', color: C.text },
  evTotal:  { fontSize: 11, color: C.muted },
  evDate:   { fontSize: 11, color: C.muted, marginLeft: 'auto' as any },
  resetBtn: { backgroundColor: C.danger + '20', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  resetTxt: { fontSize: 12, fontWeight: '700', color: C.danger },
  scRow:    { backgroundColor: C.surface, borderRadius: 12, padding: 12, borderLeftWidth: 3, borderColor: C.border },
  scType:   { fontSize: 11, fontWeight: '800', marginBottom: 4 },
  scReason: { fontSize: 13, color: C.text },
  scMeta:   { fontSize: 11, color: C.muted, marginTop: 4 },
  altRow:   { flexDirection: 'row', gap: 10, backgroundColor: C.surface, borderRadius: 12, padding: 12,
              borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  altName:  { fontSize: 14, fontWeight: '700', color: C.text },
  altMeta:  { fontSize: 11, color: C.muted },
  emptyCard: { alignItems: 'center', gap: 8, padding: 32 },
  emptyTxt:  { color: C.muted, fontSize: 14 },
})
