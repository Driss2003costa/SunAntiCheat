/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fff7ed',
          100: '#ffedd5',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
        },
        // ── "Aube sur le Monde" palette ────────────────────────────────────
        sun: {
          50:  '#FFF6E5',
          100: '#FFE9C2',
          200: '#FFD590',
          300: '#FFB347',  // primary sun gold
          400: '#F09A2E',
          500: '#E07F1A',
          600: '#B85C0E',
          700: '#8C3F0A',
        },
        ink: {
          100: '#2A3050',
          200: '#1E2440',
          300: '#161B33',
          400: '#0E1730',  // primary ink night
          500: '#0A1024',
          600: '#060A18',
          700: '#03050E',
        },
        sand: {
          200: '#F4DAB8',
          300: '#E8C5A0',
          400: '#E2A87B',  // primary sand
          500: '#C97B5C',
          600: '#9D5640',
        },
        jade: {
          200: '#A2EAE2',
          300: '#5DD4C8',  // primary jade accent
          400: '#3DB3A6',
          500: '#2C8E83',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', '"Cormorant Garamond"', 'Georgia', 'serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      backgroundImage: {
        'radial-glow': 'radial-gradient(circle at center, var(--tw-gradient-stops))',
      },
      animation: {
        'shimmer':  'shimmer 6s ease-in-out infinite',
        'twinkle':  'twinkle 4s ease-in-out infinite',
        'float':    'float 8s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%, 100%': { opacity: '0.85' },
          '50%':      { opacity: '1' },
        },
        twinkle: {
          '0%, 100%': { opacity: '0.3' },
          '50%':      { opacity: '0.9' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [],
}
