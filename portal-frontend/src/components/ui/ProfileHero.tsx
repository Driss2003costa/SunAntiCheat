import { ReactNode } from 'react'

type RoleTone = 'gold' | 'sky' | 'violet' | 'danger' | 'neutral'

interface Props {
  username: string
  role: string
  roleTone?: RoleTone
  bio?: string
  online: boolean
  joinedAt?: number | null
  lastLogin?: number | null
  uuid?: string
  actions?: ReactNode
}

const ROLE_COLORS: Record<RoleTone, { ring: string; glow: string; text: string }> = {
  gold:    { ring: 'rgba(251,191,36,0.55)',  glow: 'rgba(251,191,36,0.35)',  text: '#fcd34d' },
  sky:     { ring: 'rgba(56,189,248,0.55)',  glow: 'rgba(56,189,248,0.35)',  text: '#7dd3fc' },
  violet:  { ring: 'rgba(139,92,246,0.55)',  glow: 'rgba(139,92,246,0.35)',  text: '#c4b5fd' },
  danger:  { ring: 'rgba(239,68,68,0.55)',   glow: 'rgba(239,68,68,0.35)',   text: '#fca5a5' },
  neutral: { ring: 'rgba(148,163,184,0.45)', glow: 'rgba(148,163,184,0.25)', text: 'rgba(241,245,249,0.85)' },
}

function fmtDate(ts: number | null | undefined) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Hero spécifique à la page Profile — style "carte d'identité / passeport".
 * Volontairement différent de HeroBanner pour démarquer Profile de Home.
 *
 * Layout : avatar encadré à gauche, identité au centre, méta-data à droite.
 * Palette : aurore violet/cyan (vs. soleil orangé de Home).
 */
export default function ProfileHero({
  username, role, roleTone = 'neutral', bio,
  online, joinedAt, lastLogin, uuid, actions,
}: Props) {
  const rc = ROLE_COLORS[roleTone]

  return (
    <section className="relative overflow-hidden rounded-3xl mb-10 lg:mb-14"
             style={{
               background:
                 'radial-gradient(120% 80% at 100% 0%, rgba(139,92,246,0.18) 0%, transparent 55%), ' +
                 'radial-gradient(80% 80% at 0% 100%, rgba(93,212,200,0.16) 0%, transparent 60%), ' +
                 'linear-gradient(155deg, #131933 0%, #0a1024 100%)',
               border: '1px solid rgba(139,92,246,0.18)',
             }}>
      {/* Stripe horizontale décorative — évoque une carte d'identité */}
      <div className="absolute inset-x-0 top-0 h-1 pointer-events-none"
           style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.7), rgba(93,212,200,0.7), transparent)' }} />
      <div className="absolute inset-x-0 bottom-0 h-px pointer-events-none"
           style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} />

      {/* Décor : motif points discret */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
           style={{
             backgroundImage:
               'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)',
             backgroundSize: '22px 22px',
           }} />

      {/* Watermark "ID" */}
      <div className="absolute right-6 top-4 font-mono text-[10px] tracking-[0.4em] pointer-events-none"
           style={{ color: 'rgba(241,245,249,0.25)' }}>
        SUN-ID • {uuid ? uuid.slice(0, 8).toUpperCase() : '••••••••'}
      </div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-6 lg:gap-10 px-6 sm:px-10 lg:px-12 py-8 lg:py-10">

        {/* ── Avatar card (gauche) ─────────────────────────────────────── */}
        <div className="flex items-center justify-center lg:justify-start">
          <div className="relative">
            <div className="absolute -inset-3 rounded-3xl blur-2xl opacity-60"
                 style={{ background: rc.glow }} />
            <div className="relative rounded-3xl p-2"
                 style={{
                   background: 'rgba(15,22,40,0.6)',
                   border: `2px solid ${rc.ring}`,
                   boxShadow: `0 0 0 1px rgba(255,255,255,0.05) inset`,
                 }}>
              <div className="rounded-2xl overflow-hidden"
                   style={{ background: 'rgba(255,255,255,0.02)' }}>
                <img src={`https://mc-heads.net/body/${username}/240`}
                     alt={username}
                     className="w-32 h-44 lg:w-36 lg:h-48 object-contain"
                     onError={e => {
                       const img = e.target as HTMLImageElement
                       img.src = `https://mc-heads.net/avatar/${username}/160`
                       img.className = 'w-32 h-32 lg:w-36 lg:h-36 object-contain'
                     }} />
              </div>
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                    style={{
                      background: online ? 'rgba(16,185,129,0.18)' : 'rgba(100,116,139,0.18)',
                      border: `1px solid ${online ? 'rgba(52,211,153,0.45)' : 'rgba(148,163,184,0.35)'}`,
                      color: online ? '#6ee7b7' : 'rgba(241,245,249,0.7)',
                      backdropFilter: 'blur(6px)',
                    }}>
                <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                {online ? 'En ligne' : 'Hors ligne'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Identité (centre) ─────────────────────────────────────────── */}
        <div className="flex flex-col justify-center min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.4em]"
                  style={{ color: 'rgba(241,245,249,0.45)' }}>
              Carte joueur
            </span>
            <span className="h-px flex-1 max-w-[80px]"
                  style={{ background: 'linear-gradient(90deg, rgba(139,92,246,0.5), transparent)' }} />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold leading-none tracking-tight"
                style={{ color: '#f8fafc' }}>
              {username}
            </h1>
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest"
                  style={{
                    background: `linear-gradient(135deg, ${rc.glow}, transparent)`,
                    border: `1px solid ${rc.ring}`,
                    color: rc.text,
                  }}>
              {role}
            </span>
          </div>

          {/* Bio en citation */}
          <div className="mt-4 pl-4 max-w-xl"
               style={{ borderLeft: '2px solid rgba(139,92,246,0.35)' }}>
            <p className="text-sm lg:text-base italic"
               style={{ color: bio ? 'rgba(241,245,249,0.78)' : 'rgba(241,245,249,0.4)' }}>
              {bio ? `« ${bio} »` : 'Aucune bio. Personnalise ta carte joueur.'}
            </p>
          </div>

          {actions && (
            <div className="mt-5 flex flex-wrap gap-2">
              {actions}
            </div>
          )}
        </div>

        {/* ── Méta-data (droite) ───────────────────────────────────────── */}
        <div className="lg:min-w-[220px] grid grid-cols-2 lg:grid-cols-1 gap-3 self-center">
          <MetaRow label="Inscrit" value={fmtDate(joinedAt)} />
          <MetaRow label="Dernière connexion" value={fmtDate(lastLogin)} />
          <MetaRow label="Identifiant"
                   value={uuid ? <span className="font-mono">{uuid.slice(0, 8)}…</span> : '—'} mono />
        </div>
      </div>
    </section>
  )
}

function MetaRow({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-xl px-3 py-2"
         style={{
           background: 'rgba(15,22,40,0.5)',
           border: '1px solid rgba(255,255,255,0.06)',
         }}>
      <p className="text-[9px] font-bold uppercase tracking-[0.25em]"
         style={{ color: 'rgba(241,245,249,0.45)' }}>
        {label}
      </p>
      <p className={`text-sm mt-0.5 ${mono ? 'font-mono' : ''}`}
         style={{ color: '#f1f5f9' }}>
        {value}
      </p>
    </div>
  )
}
