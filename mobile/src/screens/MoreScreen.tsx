import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useApp } from '../context/AppContext'
import { C } from '../theme'

interface NavItem {
  icon: string; label: string; sub: string; color: string
  screen?: string; action?: () => void
}

export default function MoreScreen({ navigation }: any) {
  const { logout, setServer, user, serverUrl } = useApp()

  const host = (() => { try { return new URL(serverUrl).host } catch { return serverUrl } })()

  const sections: { title: string; items: NavItem[] }[] = [
    {
      title: 'MODÉRATION',
      items: [
        { icon: 'shield-half-outline',  label: 'Sanctions',        sub: 'Bans, mutes, kicks, warns',    color: C.warning,  screen: 'Sanctions'  },
        { icon: 'warning-outline',      label: 'Violations',       sub: 'Top offenders par points',     color: C.danger,   screen: 'Violations' },
        { icon: 'bug-outline',          label: 'Honeypot X-Ray',   sub: 'Pièges auto + triggers',       color: '#dc2626',  screen: 'Honeypot'   },
      ],
    },
    {
      title: 'SERVEUR',
      items: [
        { icon: 'people-outline',       label: 'Joueurs en ligne', sub: 'Liste + actions',              color: C.primary,  screen: 'Players'    },
        { icon: 'alert-circle-outline', label: 'Alertes anticheat',sub: 'Flux temps réel',              color: C.orange,   screen: 'Alerts'     },
        { icon: 'terminal-outline',     label: 'Console',          sub: 'Console serveur live',         color: C.success,  screen: 'Console'    },
      ],
    },
    {
      title: 'COMPTE',
      items: [
        {
          icon: 'server-outline', label: 'Changer de serveur', sub: host, color: C.primary,
          action: () => Alert.alert('Changer de serveur ?', 'Vous serez déconnecté.', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Continuer', onPress: async () => { await logout(); await setServer('') } },
          ]),
        },
        {
          icon: 'log-out-outline', label: 'Se déconnecter', sub: user?.username ?? '', color: C.danger,
          action: () => Alert.alert('Déconnexion ?', '', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Déconnecter', style: 'destructive', onPress: logout },
          ]),
        },
      ],
    },
  ]

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* User card */}
        <View style={s.userCard}>
          <View style={s.userAvatar}>
            <Text style={s.userAvatarL}>{user?.username?.[0]?.toUpperCase()}</Text>
          </View>
          <View>
            <Text style={s.username}>{user?.username}</Text>
            <View style={[s.roleBadge, { backgroundColor: user?.role === 'ADMIN' ? C.primary + '25' : C.muted + '20' }]}>
              <Text style={[s.roleTxt, { color: user?.role === 'ADMIN' ? C.primary : C.muted }]}>
                {user?.role}
              </Text>
            </View>
          </View>
          <View style={{ flex: 1 }} />
          <View style={s.serverChip}>
            <Ionicons name="server-outline" size={12} color={C.primary} />
            <Text style={s.serverChipTxt} numberOfLines={1}>{host}</Text>
          </View>
        </View>

        {sections.map(sec => (
          <View key={sec.title} style={{ marginBottom: 4 }}>
            <Text style={s.sectionTitle}>{sec.title}</Text>
            <View style={s.sectionCard}>
              {sec.items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  style={[s.item, i < sec.items.length - 1 && s.itemBorder]}
                  onPress={() => item.action ? item.action() : navigation.navigate(item.screen!)}
                  activeOpacity={0.7}>
                  <View style={[s.itemIcon, { backgroundColor: item.color + '18' }]}>
                    <Ionicons name={item.icon as any} size={20} color={item.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemLabel}>{item.label}</Text>
                    <Text style={s.itemSub} numberOfLines={1}>{item.sub}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={C.muted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <Text style={s.version}>SunGuard Mobile v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  scroll:  { padding: 16, gap: 12, paddingBottom: 32 },
  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  userAvatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.primary,
                alignItems: 'center', justifyContent: 'center' },
  userAvatarL: { color: '#fff', fontWeight: '800', fontSize: 20 },
  username:    { fontSize: 16, fontWeight: '700', color: C.text },
  roleBadge:   { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 2, alignSelf: 'flex-start' },
  roleTxt:     { fontSize: 11, fontWeight: '700' },
  serverChip:  { flexDirection: 'row', alignItems: 'center', gap: 4,
                 backgroundColor: C.surface2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  serverChipTxt: { fontSize: 11, color: C.primary, maxWidth: 100 },
  sectionTitle:  { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1.2, marginBottom: 6, marginLeft: 2 },
  sectionCard:   { backgroundColor: C.surface, borderRadius: 14, overflow: 'hidden',
                   borderWidth: 1, borderColor: C.border },
  item:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  itemBorder: { borderBottomWidth: 1, borderColor: C.border },
  itemIcon:   { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  itemLabel:  { fontSize: 15, fontWeight: '600', color: C.text },
  itemSub:    { fontSize: 12, color: C.muted, marginTop: 1 },
  version:    { fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 8 },
})
