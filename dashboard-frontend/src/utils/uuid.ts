/**
 * Génère un UUID v4 compatible avec tous les contextes.
 *
 * crypto.randomUUID() n'est dispo que sur HTTPS ou localhost,
 * donc on prévoit un fallback via Math.random() (non-cryptographique,
 * mais suffisant pour des IDs internes d'UI).
 */
export function uuid(): string {
  // Essai : navigateur moderne sur HTTPS/localhost
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {}

  // Fallback : génère un UUID v4 manuellement (RFC 4122)
  // Utilise crypto.getRandomValues si dispo (sécurisé), sinon Math.random
  const rnd = new Uint8Array(16)
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(rnd)
    } else {
      for (let i = 0; i < 16; i++) rnd[i] = Math.floor(Math.random() * 256)
    }
  } catch {
    for (let i = 0; i < 16; i++) rnd[i] = Math.floor(Math.random() * 256)
  }

  // Set version (4) and variant bits (RFC 4122)
  rnd[6] = (rnd[6] & 0x0f) | 0x40
  rnd[8] = (rnd[8] & 0x3f) | 0x80

  const hex = Array.from(rnd, b => b.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
}
