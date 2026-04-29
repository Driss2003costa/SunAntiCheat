import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { WsClient } from '../api/ws'
import { useApp } from '../context/AppContext'
import { C } from '../theme'

type LogLine = { text: string; color: string; ts: number }

function lineColor(text: string): string {
  const t = text ?? ''
  if (t.includes('[SEVERE]') || t.includes('ERROR'))  return '#ef4444'
  if (t.includes('[WARN]')  || t.includes('WARN'))    return '#f59e0b'
  if (t.includes('[INFO]'))                            return '#94a3b8'
  if (t.includes('SunAntiCheat') || t.includes('[Dashboard]')) return '#6366f1'
  return '#cbd5e1'
}

export default function ConsoleScreen() {
  const { jwt, user } = useApp()
  const [lines, setLines]   = useState<LogLine[]>([])
  const [cmd, setCmd]       = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [connected, setConnected]   = useState(false)
  const scrollRef = useRef<ScrollView>(null)
  const wsRef     = useRef<WsClient | null>(null)
  const isAdmin   = user?.role === 'ADMIN'

  useEffect(() => {
    if (!jwt || jwt === '__existing__') return
    const ws = new WsClient(jwt)
    wsRef.current = ws
    ws.connect()

    ws.subscribe('console', (data: string) => {
      setConnected(ws.connected)
      const text = typeof data === 'string' ? data : JSON.stringify(data)
      setLines(prev => [...prev, { text, color: lineColor(text), ts: Date.now() }].slice(-500))
    })

    // Poll connection status
    const t = setInterval(() => setConnected(ws.connected), 2000)
    return () => {
      clearInterval(t)
      ws.disconnect()
    }
  }, [])

  useEffect(() => {
    if (autoScroll) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)
    }
  }, [lines])

  const send = () => {
    const c = cmd.trim()
    if (!c) return
    wsRef.current?.sendCommand(c)
    setLines(prev => [...prev, { text: `> ${c}`, color: C.primary, ts: Date.now() }])
    setCmd('')
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Console</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[s.wsLight, { backgroundColor: connected ? C.success : C.danger }]} />
          <TouchableOpacity onPress={() => setLines([])} style={s.clearBtn}>
            <Ionicons name="trash-outline" size={16} color={C.muted} />
            <Text style={s.clearTxt}>Vider</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setAutoScroll(a => !a)}
            style={[s.clearBtn, autoScroll && { backgroundColor: C.primary + '20' }]}>
            <Ionicons name="arrow-down-circle-outline" size={16}
                      color={autoScroll ? C.primary : C.muted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Console output */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          style={s.output}
          contentContainerStyle={s.outputContent}
          onScrollBeginDrag={() => setAutoScroll(false)}>
          {lines.length === 0
            ? <Text style={s.empty}>En attente du serveur…{'\n'}Connexion WebSocket {connected ? '✓' : '…'}</Text>
            : lines.map((l, i) => (
              <Text key={i} style={[s.line, { color: l.color }]} selectable>
                {l.text}
              </Text>
            ))}
        </ScrollView>

        {/* Input */}
        {isAdmin ? (
          <View style={s.inputRow}>
            <Text style={s.prompt}>{'>'}</Text>
            <TextInput
              style={s.input}
              value={cmd}
              onChangeText={setCmd}
              placeholder="Commande serveur…"
              placeholderTextColor={C.muted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="send"
              onSubmitEditing={send}
              blurOnSubmit={false}
            />
            <TouchableOpacity style={[s.sendBtn, !cmd.trim() && { opacity: 0.4 }]}
                              onPress={send} disabled={!cmd.trim()}>
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.readOnly}>
            <Ionicons name="lock-closed-outline" size={14} color={C.muted} />
            <Text style={s.readOnlyTxt}>Lecture seule — admin requis pour envoyer des commandes</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#0a0c14' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 16, paddingVertical: 10,
            borderBottomWidth: 1, borderColor: C.border },
  title:  { fontSize: 18, fontWeight: '800', color: C.text },
  wsLight: { width: 8, height: 8, borderRadius: 4 },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
              backgroundColor: C.surface },
  clearTxt: { fontSize: 12, color: C.muted },

  output:        { flex: 1 },
  outputContent: { padding: 12, gap: 1 },
  empty:         { color: C.muted, fontSize: 13, fontFamily: 'monospace', textAlign: 'center', marginTop: 40 },
  line:          { fontSize: 11, fontFamily: 'monospace', lineHeight: 17 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111520', borderTopWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 8, gap: 8,
  },
  prompt:  { color: C.success, fontFamily: 'monospace', fontSize: 15, fontWeight: '700' },
  input:   { flex: 1, color: '#a0f0a0', fontSize: 13, fontFamily: 'monospace' },
  sendBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: C.primary,
             alignItems: 'center', justifyContent: 'center' },
  readOnly: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.surface, paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderColor: C.border,
  },
  readOnlyTxt: { fontSize: 12, color: C.muted, flex: 1 },
})
