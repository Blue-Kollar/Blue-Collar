import type { Config } from 'tailwindcss'

/**
 * BlueCollar Tailwind configuration.
 *
 * Note: This project uses Tailwind v4 with @tailwindcss/postcss, which reads
 * theme from CSS @theme directives (globals.css). This config file is kept as
 * a reference mirror of the design-system/tokens.ts values and for shadcn/ui
 * code generation (components.json).
 *
 * When adding or changing tokens:
 *   1. Edit design-system/tokens.ts (authoritative source)
 *   2. Mirror in this file
 *   3. Mirror CSS variables in globals.css (:root / .dark)
 */

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx}',
    './src/**/*.{md,mdx}',
  ],
  theme: {
    extend: {
      screens: {
        'contrast-more': { raw: '(prefers-contrast: more)' },
        'contrast-less': { raw: '(prefers-contrast: less)' },
      },

      ringColor:   { a11y: '#2563eb' },
      outlineColor: { a11y: '#2563eb' },

      colors: {
        'text-accessible': {
          primary:   '#111827',
          secondary: '#374151',
          muted:     '#4b5563',
        },

        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },

        neutral: {
          50:  '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },

        success: { light: '#d1fae5', DEFAULT: '#10b981', dark: '#065f46' },
        warning: { light: '#fef3c7', DEFAULT: '#f59e0b', dark: '#92400e' },
        error:   { light: '#fee2e2', DEFAULT: '#ef4444', dark: '#991b1b' },
        info:    { light: '#dbeafe', DEFAULT: '#3b82f6', dark: '#1e40af' },

        // shadcn CSS variable aliases
        background:        'hsl(var(--background))',
        foreground:        'hsl(var(--foreground))',
        card:              'hsl(var(--card))',
        'card-foreground': 'hsl(var(--card-foreground))',
        popover:           'hsl(var(--popover))',
        'popover-foreground': 'hsl(var(--popover-foreground))',
        primary:           'hsl(var(--primary))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
        secondary:         'hsl(var(--secondary))',
        'secondary-foreground': 'hsl(var(--secondary-foreground))',
        muted:             'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        accent:            'hsl(var(--accent))',
        'accent-foreground': 'hsl(var(--accent-foreground))',
        destructive:       'hsl(var(--destructive))',
        'destructive-foreground': 'hsl(var(--destructive-foreground))',
        border:            'hsl(var(--border))',
        input:             'hsl(var(--input))',
        ring:              'hsl(var(--ring))',
      },

      fontFamily: {
        sans: ['var(--font-geist-sans)', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },

      fontSize: {
        xs:   ['0.75rem',  { lineHeight: '1rem' }],
        sm:   ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem',     { lineHeight: '1.5rem' }],
        lg:   ['1.125rem', { lineHeight: '1.75rem' }],
        xl:   ['1.25rem',  { lineHeight: '1.75rem' }],
        '2xl':['1.5rem',   { lineHeight: '2rem' }],
        '3xl':['1.875rem', { lineHeight: '2.25rem' }],
        '4xl':['2.25rem',  { lineHeight: '2.5rem' }],
        '5xl':['3rem',     { lineHeight: '1' }],
      },

      fontWeight: {
        light:    '300',
        normal:   '400',
        medium:   '500',
        semibold: '600',
        bold:     '700',
      },

      spacing: {
        10: '2.5rem',
        12: '3rem',
        16: '4rem',
        20: '5rem',
        24: '6rem',
      },

      borderRadius: {
        none: '0px',
        sm:   '0.125rem',
        md:   '0.375rem',
        lg:   '0.5rem',
        xl:   '0.75rem',
        '2xl':'1rem',
        '3xl':'1.5rem',
        full: '9999px',
      },

      boxShadow: {
        sm:  '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md:  '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg:  '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl:  '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
      },

      transitionDuration: {
        fast:    '150ms',
        normal:  '200ms',
        slow:    '300ms',
        slowest: '500ms',
      },

      transitionTimingFunction: {
        'in-out': 'ease-in-out',
      },

      zIndex: {
        hide:      '-1',
        base:      '0',
        dropdown:  '1000',
        sticky:    '1020',
        fixed:     '1030',
        backdrop:  '1040',
        offcanvas: '1050',
        modal:     '1060',
        popover:   '1070',
        tooltip:   '1080',
      },

      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to:   { transform: 'translateX(0)' },
        },
      },

      animation: {
        'fade-in':         'fade-in 0.2s ease',
        'slide-in-right':  'slide-in-right 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
}

export default config
