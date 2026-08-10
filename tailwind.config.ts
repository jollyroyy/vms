import type { Config } from 'tailwindcss';

/**
 * Quest Mall design system (Aurora Glass base, Quest Mall gold/bronze palette).
 * navy/surface/brand shades are CSS-variable driven so they automatically
 * flip between light and dark themes (see :root / .dark in index.css).
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Quest Mall gold — primary brand (static mid-tones work on both themes)
        brand: {
          50:  'rgb(var(--c-brand-50) / <alpha-value>)',
          100: 'rgb(var(--c-brand-100) / <alpha-value>)',
          200: '#e8d5a8',
          300: '#d9bd7a',
          400: '#c9a558',
          500: '#b8934a',
          600: '#9c7a3c',
          700: '#7d6130',
          800: '#5f4a26',
          900: '#453620',
          950: '#2b2114',
        },
        // Bronze / copper — secondary accent
        accent: {
          50:  '#fdf6f0',
          100: '#fae8d9',
          200: '#f0cba8',
          300: '#e0a877',
          400: '#c67f4e',
          500: '#a8623a',
          600: '#8a4d2d',
          700: '#6b3a22',
          800: '#4d2a19',
          900: '#331b10',
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
        // Status scales are DELIBERATELY mixed. 50/100/700 are CSS variables,
        // so they flip with the theme: -50 is always "the faintest tint of this
        // status on the current background" and -700 is always "readable status
        // text on it". 200-600/800/900 are static, because a mid shade has to
        // stay the same hue on both themes or a green stops looking green.
        //
        // 200, 300, 400, 800 and 900 were missing entirely until they were
        // added here, which meant classes already written against them —
        // including every `dark:text-success-400` / `dark:text-danger-400`
        // meant to lift a label out of a dark card — compiled to nothing and
        // silently fell back to the light-mode shade. Keep the scales complete.
        success: {
          50:  'rgb(var(--c-success-50) / <alpha-value>)',
          100: 'rgb(var(--c-success-100) / <alpha-value>)',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: 'rgb(var(--c-success-700) / <alpha-value>)',
          800: '#166534',
          900: '#14532d',
        },
        warning: {
          50:  'rgb(var(--c-warning-50) / <alpha-value>)',
          100: 'rgb(var(--c-warning-100) / <alpha-value>)',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: 'rgb(var(--c-warning-700) / <alpha-value>)',
          800: '#92400e',
          900: '#78350f',
        },
        danger: {
          50:  'rgb(var(--c-danger-50) / <alpha-value>)',
          100: 'rgb(var(--c-danger-100) / <alpha-value>)',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: 'rgb(var(--c-danger-700) / <alpha-value>)',
          800: '#991b1b',
          900: '#7f1d1d',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        display: ['"Playfair Display"', '"Inter"', 'system-ui', 'serif'],
      },
      // ── Type scale — Minor Third (1.2), seven steps + the KPI numeral ──────
      // Size, weight and tracking travel TOGETHER so a heading cannot be used
      // at the wrong weight by accident. The rule this encodes: a heading sits
      // at least two steps above, and 200 weight units heavier than, the text
      // directly beneath it. The UI read as flat before because headings were
      // barely larger than their own subtext and no heavier.
      //
      // Unlike GatePass (whose Antic Didone ships weight 400 only), this app's
      // display face is Playfair Display, which HAS real bold weights — so a
      // font-display heading here may legitimately carry 700.
      fontSize: {
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.08em', fontWeight: '600' }],
        caption: ['0.75rem', { lineHeight: '1.125rem', fontWeight: '500' }],
        body: ['0.875rem', { lineHeight: '1.375rem', fontWeight: '400' }],
        'body-lg': ['1rem', { lineHeight: '1.5rem', fontWeight: '400' }],
        h3: ['1.125rem', { lineHeight: '1.5rem', letterSpacing: '-0.005em', fontWeight: '600' }],
        h2: ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em', fontWeight: '700' }],
        h1: ['1.75rem', { lineHeight: '2.125rem', letterSpacing: '-0.02em', fontWeight: '700' }],
        // Tabular figures come from .tabular, not here — a KPI that reflows its
        // own width as it ticks reads as broken.
        kpi: ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em', fontWeight: '800' }],
      },
      boxShadow: {
        'xs':       '0 1px 2px 0 rgb(0 0 0 / 0.03)',
        // Two soft layers — a tight contact shadow plus a wide ambient one. A
        // single heavy drop shadow is what makes a card look cheap; this reads
        // as lift without announcing itself.
        'card-premium':       '0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -12px rgb(0 0 0 / 0.10)',
        'card-premium-hover': '0 1px 2px rgb(0 0 0 / 0.05), 0 12px 32px -12px rgb(0 0 0 / 0.16)',
        'soft':     '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.03)',
        'card':     '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 4px 12px -4px rgb(0 0 0 / 0.04)',
        'elevated': '0 4px 24px -4px rgb(0 0 0 / 0.1), 0 2px 8px -2px rgb(0 0 0 / 0.04)',
        'modal':    '0 20px 60px -12px rgb(0 0 0 / 0.25), 0 8px 20px -8px rgb(0 0 0 / 0.1)',
        'glass':    '0 8px 32px 0 rgb(15 12 40 / 0.10), inset 0 1px 0 0 rgb(255 255 255 / 0.35)',
        'glass-lg': '0 24px 70px -12px rgb(15 12 40 / 0.22), inset 0 1px 0 0 rgb(255 255 255 / 0.30)',
        'glow':     '0 0 24px -6px rgb(184 147 74 / 0.45)',
        'glow-sm':  '0 0 12px -3px rgb(184 147 74 / 0.35)',
        'glow-accent': '0 0 24px -6px rgb(168 98 58 / 0.40)',
        'glow-mix': '0 8px 30px -6px rgb(184 147 74 / 0.45), 0 4px 18px -4px rgb(168 98 58 / 0.35)',
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
