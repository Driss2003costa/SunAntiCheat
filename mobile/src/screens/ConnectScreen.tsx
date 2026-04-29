import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { me, configure } from '../api/client'
import { useApp } from '../context/AppContext'
import { C } from '../theme'

export default function ConnectScreen() {
  const { setServer, history, removeServer } = useApp()
  const [url, setUrl]         = useState('http://')
  const [wsPort, setWsPort]   = useState('60036')
  const [advanced, setAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const tryConnect = async (serverUrl = url, wp = parseInt(wsPort, 10) || 60036) => {
    const clean = serverUrl.trim().replace(/\/$/, '')
    if (!clean.startsWith('http')) {
      setError('URL invalide — format : http://ip:port'); return
    }
    setLoading(true)
    setError('')
    try {
      configure(clean, wp, null)
      // Quick reachability check (unauthenticated /api/auth/login returns 405 = server is alive)
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 5000)
      const res = await fetch(`${clean}/api/auth/login`, { method: 'HEAD', signal: ctrl.signal })
        .catch(() => null)
      clearTimeout(t)
      if (!res || (res.status === 0)) {
        setError('Serveur inaccessible — vérifie l\'URL et le port')
        return
      }
      await setServer(clean, wp)
    } catch {
      setError('Impossible de joindre le serveur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <View style={s.logoWrap}>
            <View style={s.shield}>
              <Ionicons name="shield-checkmark" size={54} color={C.primary} />
            </View>
            <Text style={s.appName}>SunGuard</Text>
            <Text style={s.appSub}>Administration Mobile</Text>
          </View>

          {/* Input */}
          <View style={s.card}>
            <Text style={s.cardLabel}>ADRESSE DU SERVEUR</Text>
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                value={url}
                onChangeText={v => { setUrl(v); setError('') }}
                placeholder="http://83.143.117.40:60180"
                placeholderTextColor={C.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                onSubmitEditing={() => tryConnect()}
              />
            </View>

            {/* Advanced */}
            <TouchableOpacity style={s.advBtn} onPress={() => setAdvanced(a => !a)}>
              <Ionicons
                name={advanced ? 'chevron-up' : 'chevron-down'}
                size={14} color={C.muted} />
              <Text style={s.advText}>Options avancées</Text>
            </TouchableOpacity>

            {advanced && (
              <View style={{ marginTop: 8 }}>
                <Text style={[s.cardLabel, { marginBottom: 6 }]}>PORT WEBSOCKET</Text>
                <TextInput
                  style={[s.input, { marginBottom: 0 }]}
                  value={wsPort}
                  onChangeText={setWsPort}
                  placeholder="60036"
                  placeholderTextColor={C.muted}
                  keyboardType="numeric"
                />
                <Text style={s.advHint}>
                  Le port WS est configuré dans config.yml → dashboard.ws-port
                </Text>
              </View>
            )}

            {error ? (
              <View style={s.errorRow}>
                <Ionicons name="alert-circle" size={14} color={C.danger} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[s.btn, loading && { opacity: 0.6 }]}
              onPress={() => tryConnect()}
              disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Ionicons name="log-in-outline" size={18} color="#fff" />
                    <Text style={s.btnText}>SE CONNECTER</Text>
                  </>}
            </TouchableOpacity>
          </View>

          {/* History */}
          {history.length > 0 && (
            <View style={s.histSection}>
              <Text style={s.histTitle}>SERVEURS RÉCENTS</Text>
              {history.map(h => (
                <View key={h.url} style={s.histItem}>
                  <TouchableOpacity
                    style={s.histMain}
                    onPress={() => {
                      setUrl(h.url)
                      setWsPort(String(h.wsPort))
                      tryConnect(h.url, h.wsPort)
                    }}>
                    <Ionicons name="server-outline" size={16} color={C.primary} />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={s.histUrl} numberOfLines={1}>{h.url}</Text>
                      <Text style={s.histMeta}>WS:{h.wsPort} · {fmtAgo(h.lastUsed)}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color={C.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.histDel}
                    onPress={() =>
                      Alert.alert('Supprimer ?', h.url, [
                        { text: 'Annuler' },
                        { text: 'Supprimer', style: 'destructive', onPress: () => removeServer(h.url) },
                      ])
                    }>
                    <Ionicons name="trash-outline" size={15} color={C.muted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function fmtAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60)   return 'à l\'instant'
  if (s < 3600) return `il y a ${Math.floor(s / 60)}m`
  if (s < 86400) return `il y a ${Math.floor(s / 3600)}h`
  return `il y a ${Math.floor(s / 86400)}j`
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.bg },
  container:  { padding: 24, paddingTop: 32 },
  logoWrap:   { alignItems: 'center', marginBottom: 32 },
  shield:     {
    width: 88, height: 88, borderRadius: 24,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    shadowColor: C.primary, shadowOpacity: 0.4, shadowRadius: 20, elevation: 8,
  },
  appName:    { fontSize: 30, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  appSub:     { fontSize: 13, color: C.muted, marginTop: 4 },

  card:       { backgroundColor: C.surface, borderRadius: 16, padding: 18,
                borderWidth: 1, borderColor: C.border },
  cardLabel:  { fontSize: 10, fontWeight: '700', color: C.muted,
                letterSpacing: 1.2, marginBottom: 8 },
  inputRow:   { marginBottom: 4 },
  input:      {
    backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: C.text, fontSize: 14, marginBottom: 8,
  },
  advBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingVertical: 4, marginBottom: 4 },
  advText:    { fontSize: 12, color: C.muted },
  advHint:    { fontSize: 11, color: C.muted, marginTop: 4, lineHeight: 16 },
  errorRow:   { flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: '#ef444415', borderRadius: 8, padding: 10, marginBottom: 10 },
  errorText:  { fontSize: 13, color: C.danger, flex: 1 },
  btn:        {
    backgroundColor: C.primary, borderRadius: 10, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 8,
  },
  btnText:    { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },

  histSection: { marginTop: 28 },
  histTitle:   { fontSize: 10, fontWeight: '700', color: C.muted,
                 letterSpacing: 1.2, marginBottom: 10 },
  histItem:    {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  histMain:    { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14 },
  histUrl:     { fontSize: 14, fontWeight: '600', color: C.text },
  histMeta:    { fontSize: 11, color: C.muted, marginTop: 2 },
  histDel:     { paddingHorizontal: 14, paddingVertical: 14,
                 borderLeftWidth: 1, borderColor: C.border },
})
