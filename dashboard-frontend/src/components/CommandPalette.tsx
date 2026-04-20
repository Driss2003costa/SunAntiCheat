import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useThemeStore, type Theme } from '../stores/themeStore'
import { useAuthStore } from '../stores/authStore'

type Item = {
  id: string
  label: string
  hint?: string
  icon: string
  group: string
  action: () => void
  keywords?: string
}

/**
 * Palette ⌘K / Ctrl+K — navigation, joueurs, mondes, thèmes, actions.
 */
export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const { theme, setTheme } = useThemeStore()
  const isAdmin = useAuthStore(s => s.isAdmin())
  const logout = useAuthStore(s => s.logout)

  // Live data
  const [players, setPlayers] = useState<any[]>([])
  const [worlds, setWorlds] = useState<any[]>([])

  // ─ hotkey
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setOpen(o => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) {
      setQ(''); setSel(0)
      setTimeout(() => inputRef.current?.focus(), 50)
      api.players().then(setPlayers).catch(() => {})
      api.worlds().then(setWorlds).catch(() => {})
    }
  }, [open])

  const items: Item[] = useMemo(() => {
    const go = (path: string) => { navigate(path); setOpen(false) }
    const pages: Item[] = [
      { id: 'p-home', icon: '🏠', label: "Vue d'ensemble", group: 'Pages', action: () => go('/') },
      { id: 'p-console', icon: '⌨️', label: 'Console',      group: 'Pages', action: () => go('/console') },
      { id: 'p-worlds',  icon: '🌍', label: 'Mondes',      group: 'Pages', action: () => go('/worlds') },
      { id: 'p-players', icon: '👥', label: 'Joueurs',     group: 'Pages', action: () => go('/players') },
      { id: 'p-analytics', icon: '📈', label: 'Analytics', group: 'Pages', action: () => go('/analytics') },
      { id: 'p-economy', icon: '💰', label: 'Économie',    group: 'Pages', action: () => go('/economy') },
      { id: 'p-shop',    icon: '🛒', label: 'Shop Tracking', group: 'Pages', action: () => go('/economy/shop') },
      { id: 'p-sanctions', icon: '⚖️', label: 'Sanctions', group: 'Pages', action: () => go('/sanctions') },
      { id: 'p-reports', icon: '🚨', label: 'Reports',     group: 'Pages', action: () => go('/reports') },
      { id: 'p-tasks',   icon: '⏰', label: 'Tâches planifiées', group: 'Pages', action: () => go('/tasks') },
      { id: 'p-plugins', icon: '🧩', label: 'Plugins',     group: 'Pages', action: () => go('/plugins') },
      { id: 'p-configs', icon: '📝', label: 'Config Editor', group: 'Pages', action: () => go('/configs') },
      { id: 'p-reboot',  icon: '🔄', label: 'Reboot',      group: 'Pages', action: () => go('/reboot') },
      { id: 'p-backups', icon: '💾', label: 'Backups',     group: 'Pages', action: () => go('/backups') },
      { id: 'p-config',  icon: '⚙️', label: 'Config',      group: 'Pages', action: () => go('/config') },
    ]

    const themes: Item[] = (['dark', 'light', 'minecraft'] as Theme[]).map(t => ({
      id: `t-${t}`,
      icon: t === 'dark' ? '🌙' : t === 'light' ? '☀️' : '⛏️',
      label: `Thème — ${t[0].toUpperCase() + t.slice(1)}`,
      hint: theme === t ? '(actuel)' : '',
      group: 'Thèmes',
      action: () => { setTheme(t); setOpen(false) },
    }))

    const playerItems: Item[] = players.slice(0, 30).map(p => ({
      id: `pl-${p.uuid || p.name}`,
      icon: '👤',
      label: p.name,
      hint: p.world || '',
      group: 'Joueurs en ligne',
      keywords: p.uuid,
      action: () => { navigate(`/players?q=${encodeURIComponent(p.name)}`); setOpen(false) },
    }))

    const worldItems: Item[] = worlds.slice(0, 10).map(w => ({
      id: `w-${w.name}`,
      icon: '🌐',
      label: w.name,
      hint: `${w.players || 0} joueurs`,
      group: 'Mondes',
      action: () => { navigate('/worlds'); setOpen(false) },
    }))

    const actions: Item[] = isAdmin ? [
      { id: 'a-reboot-now', icon: '⚠️', label: 'Reboot serveur maintenant (5s)', group: 'Actions',
        action: async () => { if (confirm('Reboot dans 5 secondes ?')) { await api.rebootNow(); setOpen(false) } } },
      { id: 'a-save-all', icon: '💾', label: 'save-all', group: 'Actions',
        action: async () => { await api.runCommand('save-all'); setOpen(false) } },
      { id: 'a-tps', icon: '📊', label: 'tps', group: 'Actions',
        action: async () => { await api.runCommand('tps'); setOpen(false) } },
      { id: 'a-logout', icon: '🚪', label: 'Déconnexion', group: 'Actions',
        action: () => { logout(); navigate('/login'); setOpen(false) } },
    ] : [
      { id: 'a-logout', icon: '🚪', label: 'Déconnexion', group: 'Actions',
        action: () => { logout(); navigate('/login'); setOpen(false) } },
    ]

    return [...pages, ...themes, ...playerItems, ...worldItems, ...actions]
  }, [navigate, players, worlds, theme, setTheme, isAdmin, logout])

  const filtered = useMemo(() => {
    if (!q.trim()) return items
    const needle = q.toLowerCase()
    return items.filter(i =>
      i.label.toLowerCase().includes(needle) ||
      i.group.toLowerCase().includes(needle) ||
      (i.keywords || '').toLowerCase().includes(needle)
    )
  }, [q, items])

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>()
    filtered.forEach(i => {
      if (!map.has(i.group)) map.set(i.group, [])
      map.get(i.group)!.push(i)
    })
    return Array.from(map.entries())
  }, [filtered])

  useEffect(() => { setSel(0) }, [q])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[10vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl mx-4 rounded-2xl overflow-hidden border shadow-2xl"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <span className="text-xl">🔎</span>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent outline-none text-base"
            placeholder="Recherche pages, joueurs, mondes, actions…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(filtered.length - 1, s + 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)) }
              else if (e.key === 'Enter' && filtered[sel]) { e.preventDefault(); filtered[sel].action() }
            }}
          />
          <span className="kbd">ESC</span>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {filtered.length === 0 && (
            <div className="px-4 py-10 text-center" style={{ color: 'var(--text-muted)' }}>
              Aucun résultat pour « {q} »
            </div>
          )}
          {grouped.map(([group, groupItems]) => (
            <div key={group}>
              <div className="px-4 py-1 text-[10px] uppercase tracking-wider sticky top-0"
                   style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                {group}
              </div>
              {groupItems.map(item => {
                const idx = filtered.indexOf(item)
                const active = idx === sel
                return (
                  <button
                    key={item.id}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                    style={{ background: active ? 'var(--surface-2)' : 'transparent' }}
                    onMouseEnter={() => setSel(idx)}
                    onClick={() => item.action()}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="flex-1 text-sm">{item.label}</span>
                    {item.hint && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.hint}</span>
                    )}
                    {active && <span className="kbd">↵</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-4 py-2 text-xs border-t"
             style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          <div className="flex items-center gap-2">
            <span className="kbd">↑</span><span className="kbd">↓</span> Naviguer
            <span className="kbd ml-2">↵</span> Ouvrir
          </div>
          <div className="flex items-center gap-1">
            <span className="kbd">⌘</span><span className="kbd">K</span>
          </div>
        </div>
      </div>
    </div>
  )
}
