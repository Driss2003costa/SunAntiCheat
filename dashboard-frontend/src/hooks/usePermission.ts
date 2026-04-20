import { useAuthStore } from '../stores/authStore'

/**
 * Retourne les permissions de l'utilisateur connecté.
 *
 * isAdmin  — ADMIN uniquement (gestion comptes, config, plugins…)
 * canEdit  — MOD ou ADMIN (toutes les actions d'écriture)
 * isViewer — VIEWER uniquement (lecture seule)
 */
export function usePermission() {
  const role    = useAuthStore(s => s.role)
  const isAdmin  = role === 'ADMIN'
  const canEdit  = role === 'ADMIN' || role === 'MOD'
  const isViewer = role === 'VIEWER'

  return { role, isAdmin, canEdit, isViewer }
}
