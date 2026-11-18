import type { Config } from 'tailwindcss'
import { tokens } from './design-system/tokens'

/**
 * BlueCollar Tailwind configuration.
 *
 * SOURCE OF TRUTH: design-system/tokens.ts
 * All colors, spacing, radii, shadows, transitions, z-index and breakpoints
 * below are derived from that module. Do not hardcode literal values here —
 * import from `tokens` instead so the Tailwind theme stays in sync.
 *
 * Note: This project uses Tailwind v4 with @tailwindcss/postcss, which reads
 * theme from CSS @theme directives (globals.css). This config file is kept as
 * a reference mirror of the design-system/tokens.ts values and for shadcn/ui
 * code generation (components.json).
 *
 * When adding or changing tokens:
 *   1. Edit design-system/tokens.ts (authoritative source)
 *   2. Values flow into this file automatically via the `tokens` import
 *   3. Mirror CSS variables in globals.css (:root / .dark)
 */

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        ...tokens.breakpoints,
        'contrast-more': { raw: '(prefers-contrast: more)' },
        'contrast-less': { raw: '(prefers-contrast: less)' },
      },

      ringColor:   { a11y: tokens.colors.brand[600] },
      outlineColor: { a11y: tokens.colors.brand[600] },

      colors: {
        'text-accessible': {
          primary:   tokens.colors.neutral[900],
          secondary: tokens.colors.neutral[700],
          muted:     tokens.colors.neutral[600],
        },

        brand: tokens.colors.brand,

        neutral: tokens.colors.neutral,

        success: tokens.colors.success,
        warning: tokens.colors.warning,
        error:   tokens.colors.error,
        info:    tokens.colors.info,

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

      fontSize: tokens.fontSize,

      fontWeight: tokens.fontWeight,

      spacing: tokens.spacing,

      borderRadius: tokens.borderRadius,

      boxShadow: tokens.boxShadow,

      transitionDuration: tokens.transitionDuration,

      transitionTimingFunction: tokens.transitionTimingFunction,

      zIndex: tokens.zIndex,

      keyframes: tokens.keyframes,

      animation: tokens.animation,
    },
  },
  plugins: [],
}

export default config
