import type { Config } from 'tailwindcss';

/**
 * Aurora Glass design system.
 * navy/surface/brand shades are CSS-variable driven so they automatically
 * flip between light and dark themes (see :root / .dark in index.css).
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Violet — primary brand (static mid-tones work on both themes)
        brand: {
          50:  'rgb(var(--c-brand-50) / <alpha-value>)',
          100: 'rgb(var(--c-brand-100) / <alpha-value>)',
          200: '#c4b5fd',
          300: '#a78bfa',
          400: '#8b5cf6',
          500: '#7c3aed',
          600: '#6d28d9',
          700: '#5b21b6',
          800: '#4c1d95',
          900: '#3b0764',
          950: '#2e1065',
        },
        // Magenta / fuchsia — secondary accent
        accent: {
          50:  '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
        },
        // Semantic neutrals — auto-flip with theme via CSS vars
        navy: {
          50:  'rgb(var(--c-navy-50) / <alpha-value>)',
          100: 'rgb(var(--c-navy-100) / <alpha-value>)',
          200: 'rgb(var(--c-navy-200) / <alpha-value>)',
          300: 'rgb(var(--c-navy-300) / <alpha-value>)',
          400: 'rgb(var(--c-navy-400) / <alpha-value>)',
          500: 'rgb(var(--c-navy-500) / <alpha-value>)',
          600: 'rgb(var(--c-navy-600) / <alpha-value>)',
          700: 'rgb(var(--c-navy-700) / <alpha-value>)',
          800: 'rgb(var(--c-navy-800) / <alpha-value>)',
          900: 'rgb(var(--c-navy-900) / <alpha-value>)',
          950: 'rgb(var(--c-navy-950) / <alpha-value>)',
        },
        surface: {
          50:  'rgb(var(--c-surface-50) / <alpha-value>)',
          100: 'rgb(var(--c-surface-100) / <alpha-value>)',
          200: 'rgb(var(--c-surface-200) / <alpha-value>)',
          300: 'rgb(var(--c-surface-300) / <alpha-value>)',
          400: 'rgb(var(--c-surface-400) / <alpha-value>)',
        },
        success: {
          50:  'rgb(var(--c-success-50) / <alpha-value>)',
          100: 'rgb(var(--c-success-100) / <alpha-value>)',
          500: '#22c55e',
          600: '#16a34a',
          700: 'rgb(var(--c-success-700) / <alpha-value>)',
        },
        warning: {
          50:  'rgb(var(--c-warning-50) / <alpha-value>)',
          100: 'rgb(var(--c-warning-100) / <alpha-value>)',
          500: '#f59e0b',
          600: '#d97706',
          700: 'rgb(var(--c-warning-700) / <alpha-value>)',
        },
        danger: {
          50:  'rgb(var(--c-danger-50) / <alpha-value>)',
          100: 'rgb(var(--c-danger-100) / <alpha-value>)',
          500: '#ef4444',
          600: '#dc2626',
          700: 'rgb(var(--c-danger-700) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        display: ['"Space Grotesk"', '"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'xs':       '0 1px 2px 0 rgb(0 0 0 / 0.03)',
        'soft':     '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.03)',
        'card':     '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 4px 12px -4px rgb(0 0 0 / 0.04)',
        'elevated': '0 4px 24px -4px rgb(0 0 0 / 0.1), 0 2px 8px -2px rgb(0 0 0 / 0.04)',
        'modal':    '0 20px 60px -12px rgb(0 0 0 / 0.25), 0 8px 20px -8px rgb(0 0 0 / 0.1)',
        'glass':    '0 8px 32px 0 rgb(15 12 40 / 0.10), inset 0 1px 0 0 rgb(255 255 255 / 0.35)',
        'glass-lg': '0 24px 70px -12px rgb(15 12 40 / 0.22), inset 0 1px 0 0 rgb(255 255 255 / 0.30)',
        'glow':     '0 0 24px -6px rgb(124 58 237 / 0.45)',
        'glow-sm':  '0 0 12px -3px rgb(124 58 237 / 0.35)',
        'glow-accent': '0 0 24px -6px rgb(217 70 239 / 0.40)',
        'glow-mix': '0 8px 30px -6px rgb(124 58 237 / 0.45), 0 4px 18px -4px rgb(217 70 239 / 0.35)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        pulse_soft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        auroraDrift: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(40px, -30px) scale(1.08)' },
          '66%': { transform: 'translate(-30px, 25px) scale(0.94)' },
        },
        auroraDriftAlt: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(-45px, 35px) scale(1.1)' },
          '66%': { transform: 'translate(35px, -20px) scale(0.92)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'pulse-soft': 'pulse_soft 2s ease-in-out infinite',
        'aurora': 'auroraDrift 18s ease-in-out infinite',
        'aurora-alt': 'auroraDriftAlt 22s ease-in-out infinite',
        'gradient-x': 'gradientShift 6s ease infinite',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
} satisfies Config;
