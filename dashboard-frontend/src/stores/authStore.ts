import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  username: string | null
  role: string | null
  login: (token: string, username: string, role: string) => void
  logout: () => void
  isAuthenticated: () => boolean
  isAdmin: () => boolean
  /** MOD ou ADMIN — peut effectuer des actions d'écriture */
  canEdit: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      username: null,
      role: null,
      login: (token, username, role) => set({ token, username, role }),
      logout: () => set({ token: null, username: null, role: null }),
      isAuthenticated: () => !!get().token,
      isAdmin: () => get().role === 'ADMIN',
      canEdit: () => get().role === 'ADMIN' || get().role === 'MOD',
    }),
    { name: 'sun-dashboard-auth' }
  )
)
