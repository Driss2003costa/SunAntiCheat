import { usePermission } from '../hooks/usePermission'

interface Props {
  /** Niveau requis. 'edit' = MOD+, 'admin' = ADMIN uniquement. */
  require: 'edit' | 'admin'
  /** Affiché si la permission est refusée (rien par défaut). */
  fallback?: React.ReactNode
  children: React.ReactNode
}

/**
 * Masque son contenu si l'utilisateur n'a pas le niveau requis.
 *
 * Usage :
 *   <PermGuard require="edit">
 *     <button>Créer</button>
 *   </PermGuard>
 *
 *   <PermGuard require="admin" fallback={<span>Admin only</span>}>
 *     <DangerousAction />
 *   </PermGuard>
 */
export default function PermGuard({ require, fallback = null, children }: Props) {
  const { isAdmin, canEdit } = usePermission()
  const allowed = require === 'admin' ? isAdmin : canEdit
  return allowed ? <>{children}</> : <>{fallback}</>
}
