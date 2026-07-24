/** @type {import('tailwindcss').Config} */
const animate = require('tailwindcss-animate');

module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Основной бренд — теннисный зелёный корта
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        // Акцент — мячик (неоновый жёлто-зелёный)
        court: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#ccff00',
          600: '#a3e635',
          700: '#84cc16',
        },
        live: {
          DEFAULT: '#ef4444',
          pulse: '#f87171',
        },
        // Поверхности (используются через CSS-переменные в globals.css)
        surface: {
          DEFAULT: 'hsl(var(--surface) / <alpha-value>)',
          muted: 'hsl(var(--surface-muted) / <alpha-value>)',
          card: 'hsl(var(--surface-card) / <alpha-value>)',
          border: 'hsl(var(--surface-border) / <alpha-value>)',
        },
        content: {
          DEFAULT: 'hsl(var(--content) / <alpha-value>)',
          muted: 'hsl(var(--content-muted) / <alpha-value>)',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        xxs: ['0.625rem', { lineHeight: '0.875rem' }],
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(1.15)' },
        },
      },
      animation: {
        'pulse-dot': 'pulse-dot 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [animate],
};
