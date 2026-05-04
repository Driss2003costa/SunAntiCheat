import { useState } from 'react'

// Détecte un nom de matériau Bukkit (ex: OAK_LOG, DIAMOND_PICKAXE)
function isMaterial(s: string): boolean {
  return /^[A-Z][A-Z0-9_]{1,}$/.test(s)
}

/**
 * Affiche l'icône d'un métier custom :
 * - Nom de matériau Bukkit → texture Minecraft via CDN (pixelated)
 * - Emoji / texte         → affiché directement
 * - null / vide           → 💼
 */
export default function MinecraftIcon({
  icon,
  size = 32,
  className = '',
  fallback = '💼',
}: {
  icon?: string | null
  size?: number
  className?: string
  fallback?: string
}) {
  const [err, setErr] = useState(false)

  if (!icon) return <span className={className} style={{ fontSize: size * 0.75 }}>{fallback}</span>

  if (!err && isMaterial(icon)) {
    return (
      <img
        src={`https://mc.nerothe.com/img/1.21.1/${icon.toLowerCase()}.png`}
        alt={icon}
        width={size}
        height={size}
        className={className}
        style={{ imageRendering: 'pixelated', width: size, height: size, objectFit: 'contain' }}
        onError={() => setErr(true)}
      />
    )
  }

  // emoji ou texte court → affichage direct
  return <span className={className} style={{ fontSize: size * 0.75, lineHeight: 1 }}>{icon}</span>
}
