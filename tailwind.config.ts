import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0fdf9',
          100: '#ccfbef',
          200: '#99f6df',
          300: '#5fe8ca',
          400: '#2dd4b0',
          500: '#14b898',
          600: '#0d947b',
          700: '#0f7664',
          800: '#115e52',
          900: '#134e44',
          950: '#042f2a',
        },
        navy: {
          50:  '#f4f6fb',
          100: '#e8ecf6',
          200: '#ccd5eb',
          300: '#9fb1d9',
          400: '#6b88c2',
          500: '#4769ab',
          600: '#35528f',
          700: '#2c4274',
          800: '#283a61',
          900: '#1e2d4a',
          950: '#131c31',
        },
        surface: {
          50:  '#fafaf9',
          100: '#f5f4f2',
          200: '#e7e5e1',
          300: '#d5d2cc',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 1px 2px 0 rgb(0 0 0 / 0.03), 0 1px 3px -1px rgb(0 0 0 / 0.03)',
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 2px 8px -2px rgb(0 0 0 / 0.04)',
        'elevated': '0 4px 16px -4px rgb(0 0 0 / 0.08), 0 2px 6px -2px rgb(0 0 0 / 0.04)',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0', transform: 'scale(0.95)' }, to: { opacity: '1', transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
} satisfies Config;
