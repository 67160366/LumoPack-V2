/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // LumoPack Brand Colors — Packaging Industry Palette
        lumo: {
          50:  '#fdf8f0',
          100: '#f9eddb',
          200: '#f2d8b4',
          300: '#e8be84',
          400: '#d4a373',  // ← Cardboard brown (primary accent)
          500: '#c4884c',
          600: '#b67040',
          700: '#975836',
          800: '#7b4831',
          900: '#65392a',
        },
        panel: {
          dark:    '#1a1d23',  // Dark panel background
          darker:  '#13151a',  // Darker variant
          surface: '#22252d',  // Card/surface on dark
          border:  '#2e3139',  // Border on dark panels
          hover:   '#2a2d35',  // Hover state
        },
        chat: {
          bg:      '#f5f0ea',  // Chat area warm background
          user:    '#d4a373',  // User bubble
          bot:     '#22252d',  // Bot bubble
          input:   '#1a1d23',  // Input area
        },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        body:    ['"DM Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'fade-in':     'fadeIn 0.3s ease-out',
        'slide-up':    'slideUp 0.3s ease-out',
        'slide-right': 'slideRight 0.3s ease-out',
        'pulse-soft':  'pulseSoft 2s ease-in-out infinite',
        'typing':      'typing 1.2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideRight: {
          '0%':   { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.6' },
          '50%':      { opacity: '1' },
        },
        typing: {
          '0%':   { opacity: '0.3' },
          '50%':  { opacity: '1' },
          '100%': { opacity: '0.3' },
        },
      },
    },
  },
  plugins: [],
}