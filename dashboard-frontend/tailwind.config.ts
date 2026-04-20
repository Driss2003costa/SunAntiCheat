import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#0f0f13',
        surface:  '#1a1a24',
        border:   '#2d2d3d',
        primary:  '#7C3AED',
        danger:   '#EF4444',
        success:  '#10B981',
        warning:  '#F59E0B',
        info:     '#3B82F6',
        muted:    '#64748b',
      },
    },
  },
  plugins: [],
} satisfies Config
