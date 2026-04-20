import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'dark' | 'light' | 'minecraft'

interface ThemeState {
  theme: Theme
  setTheme: (t: Theme) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
    }),
    {
      name: 'sun-dashboard-theme',
      onRehydrateStorage: () => (state) => { if (state) applyTheme(state.theme) },
    }
  )
)

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.remove('theme-dark', 'theme-light', 'theme-minecraft')
  root.classList.add(`theme-${theme}`)
  root.dataset.theme = theme
}
