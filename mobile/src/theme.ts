export const C = {
  bg:         '#0f1117',
  surface:    '#1a1d27',
  surface2:   '#252836',
  border:     '#2a2d3e',
  primary:    '#6366f1',
  primaryDim: '#4f46e5',
  text:       '#e2e8f0',
  muted:      '#64748b',
  success:    '#10b981',
  warning:    '#f59e0b',
  danger:     '#ef4444',
  orange:     '#f97316',
  gold:       '#eab308',
}

export const S = {
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  label: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: C.muted,
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: C.text,
  },
  mono: {
    fontFamily: 'monospace' as const,
    fontSize: 12,
  },
}

export function tpsColor(tps: number) {
  if (tps >= 18) return C.success
  if (tps >= 15) return C.warning
  return C.danger
}

export function violationColor(pts: number) {
  if (pts >= 100) return C.danger
  if (pts >= 50)  return C.orange
  if (pts >= 20)  return C.warning
  return C.success
}

export function solidFacesInfo(n: number): { label: string; color: string } {
  if (n >= 6) return { label: 'CERTAIN',       color: '#dc2626' }
  if (n >= 5) return { label: 'QUASI-CERTAIN', color: C.danger  }
  if (n >= 4) return { label: 'TRÈS SUSPECT',  color: C.orange  }
  return           { label: 'SUSPECT',         color: C.warning }
}
