import { useEffect, useMemo, useState } from 'react'
import Editor, { DiffEditor } from '@monaco-editor/react'
import { api } from '../api/client'
import { useAuthStore } from '../stores/authStore'
import { useThemeStore } from '../stores/themeStore'

type FileNode = { name: string; path: string; size: number; modified: number }
type PluginNode = { name: string; version: string; enabled: boolean; files: FileNode[] }

const LANGUAGE_BY_EXT: Record<string, string> = {
  yml: 'yaml', yaml: 'yaml', json: 'json', properties: 'ini', toml: 'ini', conf: 'ini', txt: 'plaintext',
}
const ext = (name: string) => name.split('.').pop()?.toLowerCase() ?? ''
const fmtSize = (b: number) => b < 1024 ? `${b}B` : b < 1048576 ? `${(b/1024).toFixed(1)}KB` : `${(b/1048576).toFixed(1)}MB`
const fmtDate = (ts: number) => new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function ConfigEditorPage() {
  const [tree, setTree] = useState<PluginNode[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [filterQ, setFilterQ] = useState('')
  const [selected, setSelected] = useState<{ plugin: string; path: string; name: string } | null>(null)
  const [content, setContent] = useState('')
  const [original, setOriginal] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [diffMode, setDiffMode] = useState(false)
  const [previewVersion, setPreviewVersion] = useState<string | null>(null)

  const isAdmin = useAuthStore(s => s.isAdmin())
  const theme = useThemeStore(s => s.theme)
  const monacoTheme = theme === 'light' ? 'vs' : 'vs-dark'

  useEffect(() => { api.configTree().then(setTree) }, [])

  const load = async (plugin: string, path: string, name: string) => {
    setSelected({ plugin, path, name })
    setContent(''); setOriginal(''); setDiffMode(false); setShowHistory(false); setPreviewVersion(null); setMsg(null)
    const res = await api.configRead(plugin, path)
    setContent(res.content)
    setOriginal(res.content)
    const hist = await api.configHistory(plugin, path).catch(() => [])
    setHistory(hist)
  }

  const save = async () => {
    if (!selected) return
    setSaving(true); setMsg(null)
    try {
      await api.configWrite(selected.plugin, selected.path, content)
      setOriginal(content)
      setMsg({ type: 'ok', text: '✓ Enregistré. Pense à /reload ce plugin dans la page Plugins.' })
      const hist = await api.configHistory(selected.plugin, selected.path).catch(() => [])
      setHistory(hist)
    } catch (e: any) {
      setMsg({ type: 'err', text: 'Erreur : ' + e.message })
    } finally { setSaving(false) }
  }

  const loadVersion = async (ts: number) => {
    if (!selected) return
    const v = await api.configVersion(selected.plugin, selected.path, ts)
    setPreviewVersion(v.content)
    setDiffMode(true)
  }

  const restoreVersion = () => {
    if (previewVersion !== null) { setContent(previewVersion); setPreviewVersion(null); setDiffMode(false); setMsg({ type: 'info', text: 'Version chargée — clique Enregistrer pour confirmer.' }) }
  }

  const dirty = content !== original
  const lang = selected ? (LANGUAGE_BY_EXT[ext(selected.name)] || 'plaintext') : 'plaintext'

  const filteredTree = useMemo(() => {
    if (!filterQ.trim()) return tree
    const q = filterQ.toLowerCase()
    return tree
      .map(p => ({ ...p, files: p.files.filter(f => p.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)) }))
      .filter(p => p.name.toLowerCase().includes(q) || p.files.length > 0)
  }, [tree, filterQ])

  return (
    <div className="flex h-full" style={{ height: 'calc(100vh - 0px)' }}>
      {/* Sidebar arborescence */}
      <aside
        className="w-72 shrink-0 flex flex-col overflow-hidden"
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      >
        <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="font-semibold mb-2">📝 Config Editor</div>
          <input className="input text-xs" placeholder="Filtrer..." value={filterQ} onChange={e => setFilterQ(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {filteredTree.map(p => {
            const isOpen = expanded.has(p.name) || !!filterQ.trim()
            return (
              <div key={p.name}>
                <button
                  className="w-full flex items-center justify-between px-3 py-1.5 text-sm hover:bg-white/5"
                  onClick={() => {
                    const copy = new Set(expanded)
                    if (copy.has(p.name)) copy.delete(p.name); else copy.add(p.name)
                    setExpanded(copy)
                  }}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-xs">{isOpen ? '▼' : '▶'}</span>
                    <span className="truncate">{p.name}</span>
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {p.files.length}
                  </span>
                </button>
                {isOpen && p.files.map(f => (
                  <button
                    key={f.path}
                    onClick={() => load(p.name, f.path, f.name)}
                    className="w-full flex items-center justify-between pl-9 pr-3 py-1 text-xs text-left"
                    style={{
                      background: selected?.plugin === p.name && selected.path === f.path
                        ? 'color-mix(in srgb, var(--primary) 20%, transparent)' : 'transparent',
                      color: selected?.plugin === p.name && selected.path === f.path ? 'var(--primary)' : 'var(--text-muted)',
                    }}
                  >
                    <span className="truncate">{f.path}</span>
                    <span className="ml-2 shrink-0" style={{ fontSize: 10 }}>{fmtSize(f.size)}</span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </aside>

      {/* Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
            <div className="text-center">
              <div className="text-6xl mb-3">📄</div>
              <div>Sélectionne un fichier pour l'éditer</div>
            </div>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="px-4 py-2 flex items-center justify-between gap-3 flex-wrap border-b"
                 style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold truncate">{selected.plugin}</span>
                <span style={{ color: 'var(--text-muted)' }}>/</span>
                <span className="font-mono text-sm truncate">{selected.path}</span>
                {dirty && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F59E0B', color: 'white' }}>modifié</span>}
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-ghost text-xs" onClick={() => setShowHistory(s => !s)}>
                  🕐 Historique ({history.length})
                </button>
                {diffMode && <button className="btn-ghost text-xs" onClick={() => { setDiffMode(false); setPreviewVersion(null) }}>✕ Fermer diff</button>}
                {isAdmin && (
                  <button className="btn-primary text-xs" disabled={!dirty || saving} onClick={save}>
                    {saving ? '⏳' : '💾'} Enregistrer
                  </button>
                )}
              </div>
            </div>

            {msg && (
              <div className="px-4 py-2 text-sm" style={{
                background: msg.type === 'ok' ? 'rgba(16,185,129,0.15)' : msg.type === 'err' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
                color: msg.type === 'ok' ? '#10B981' : msg.type === 'err' ? '#EF4444' : '#3B82F6',
              }}>
                {msg.text}
              </div>
            )}

            <div className="flex-1 flex overflow-hidden">
              {/* Editor / Diff */}
              <div className="flex-1 min-w-0">
                {diffMode && previewVersion !== null ? (
                  <DiffEditor
                    theme={monacoTheme}
                    language={lang}
                    original={previewVersion}
                    modified={content}
                    options={{ readOnly: !isAdmin, renderSideBySide: true, fontSize: 13 }}
                  />
                ) : (
                  <Editor
                    theme={monacoTheme}
                    language={lang}
                    value={content}
                    onChange={v => setContent(v ?? '')}
                    options={{ readOnly: !isAdmin, fontSize: 13, minimap: { enabled: false }, wordWrap: 'on' }}
                  />
                )}
              </div>

              {/* History panel */}
              {showHistory && (
                <div className="w-64 shrink-0 overflow-y-auto border-l"
                     style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="p-3 border-b font-semibold text-sm" style={{ borderColor: 'var(--border)' }}>
                    Versions précédentes
                  </div>
                  {history.length === 0 ? (
                    <div className="p-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      Aucune version — le premier enregistrement créera un snapshot.
                    </div>
                  ) : history.map(h => (
                    <button
                      key={h.timestamp}
                      className="w-full text-left px-3 py-2 border-b hover:bg-white/5 text-xs"
                      style={{ borderColor: 'var(--border)' }}
                      onClick={() => loadVersion(h.timestamp)}
                    >
                      <div className="font-medium">{fmtDate(h.timestamp)}</div>
                      <div style={{ color: 'var(--text-muted)' }}>{fmtSize(h.size)}</div>
                    </button>
                  ))}
                  {diffMode && isAdmin && (
                    <div className="p-3">
                      <button className="btn-primary text-xs w-full" onClick={restoreVersion}>
                        ← Restaurer cette version
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
