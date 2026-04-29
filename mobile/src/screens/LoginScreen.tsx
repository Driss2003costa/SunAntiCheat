import React, { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { login, me } from '../api/client'
import { useApp } from '../context/AppContext'
import { C } from '../theme'

export default function LoginScreen() {
  const { serverUrl, setAuth, setServer } = useApp()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totp, setTotp]         = useState('')
  const [showTotp, setShowTotp] = useState(false)
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError]       = useState('')

  // Auto-login if JWT is still valid
  useEffect(() => {
    ;(async () => {
      try {
        const user = await me()
        await setAuth('__existing__', user)
      } catch {
        // JWT expired or missing — show login form
      } finally {
        setChecking(false)
      }
    })()
  }, [])

  const doLogin = async () => {
    if (!username.trim() || !password) { setError('Identifiants requis'); return }
    setLoading(true)
    setError('')
    try {
      const { token, username: u, role } = await login(username.trim(), password,
                                                        showTotp ? totp : undefined)
      await setAuth(token, { username: u, role })
    } catch (e: any) {
      const msg: string = e?.message ?? ''
      if (msg.includes('TOTP') || msg.includes('2FA') || msg.toLowerCase().includes('two')) {
        setShowTotp(true)
        setError('Code 2FA requis')
      } else {
        setError('Identifiants incorrects')
      }
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={s.checkingTxt}>Vérification de la session…</Text>
      </View>
    )
  }

  const host = (() => {
    try { return new URL(serverUrl).host } catch { return serverUrl }
  })()

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'center', padding: 24 }}
                            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Server badge */}
        <View style={s.serverBadge}>
          <Ionicons name="server-outline" size={14} color={C.primary} />
          <Text style={s.serverText} numberOfLines={1}>{host}</Text>
          <TouchableOpacity onPress={() => setServer('')} style={{ marginLeft: 6 }}>
            <Ionicons name="close-circle" size={16} color={C.muted} />
          </TouchableOpacity>
        </View>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Connexion</Text>
          <Text style={s.sub}>Dashboard SunAntiCheat</Text>
        </View>

        {/* Form */}
        <View style={s.card}>
          {/* Username */}
          <View style={s.fieldWrap}>
            <Ionicons name="person-outline" size={16} color={C.muted} style={s.fieldIcon} />
            <TextInput
              style={s.fieldInput}
              placeholder="Nom d'utilisateur"
              placeholderTextColor={C.muted}
              value={username}
              onChangeText={v => { setUsername(v); setError('') }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          {/* Password */}
          <View style={s.fieldWrap}>
            <Ionicons name="lock-closed-outline" size={16} color={C.muted} style={s.fieldIcon} />
            <TextInput
              style={[s.fieldInput, { flex: 1 }]}
              placeholder="Mot de passe"
              placeholderTextColor={C.muted}
              value={password}
              onChangeText={v => { setPassword(v); setError('') }}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType={showTotp ? 'next' : 'go'}
              onSubmitEditing={showTotp ? undefined : doLogin}
            />
            <TouchableOpacity onPress={() => setShowPw(p => !p)} style={s.eye}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.muted} />
            </TouchableOpacity>
          </View>

          {/* TOTP */}
          {showTotp && (
            <View style={s.fieldWrap}>
              <Ionicons name="shield-outline" size={16} color={C.warning} style={s.fieldIcon} />
              <TextInput
                style={s.fieldInput}
                placeholder="Code 2FA (6 chiffres)"
                placeholderTextColor={C.muted}
                value={totp}
                onChangeText={v => { setTotp(v); setError('') }}
                keyboardType="numeric"
                maxLength={6}
                returnKeyType="go"
                onSubmitEditing={doLogin}
              />
            </View>
          )}

          {error ? (
            <View style={s.errorRow}>
              <Ionicons name="warning-outline" size={14} color={C.danger} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={[s.btn, loading && { opacity: 0.6 }]}
                            onPress={doLogin} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Ionicons name="log-in" size={18} color="#fff" />
                  <Text style={s.btnText}>SE CONNECTER</Text>
                </>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.bg },
  center:     { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  checkingTxt: { color: C.muted, fontSize: 14 },

  serverBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.surface, borderRadius: 20, paddingHorizontal: 12,
    paddingVertical: 6, borderWidth: 1, borderColor: C.border,
    alignSelf: 'center', marginBottom: 24,
  },
  serverText: { fontSize: 12, color: C.primary, maxWidth: 200 },

  header: { alignItems: 'center', marginBottom: 24 },
  title:  { fontSize: 26, fontWeight: '800', color: C.text },
  sub:    { fontSize: 13, color: C.muted, marginTop: 4 },

  card:    { backgroundColor: C.surface, borderRadius: 16, padding: 18,
             borderWidth: 1, borderColor: C.border, gap: 10 },
  fieldWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface2, borderRadius: 10,
    borderWidth: 1, borderColor: C.border, paddingHorizontal: 12,
  },
  fieldIcon:  { marginRight: 8 },
  fieldInput: { flex: 1, paddingVertical: 13, color: C.text, fontSize: 15 },
  eye:        { padding: 4 },

  errorRow:  { flexDirection: 'row', alignItems: 'center', gap: 6,
               backgroundColor: '#ef444415', borderRadius: 8, padding: 10 },
  errorText: { fontSize: 13, color: C.danger },

  btn:     {
    backgroundColor: C.primary, borderRadius: 10, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15, letterSpacing: 0.5 },
})
