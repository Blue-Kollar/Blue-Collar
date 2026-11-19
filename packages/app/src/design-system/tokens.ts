/**
 * Design tokens for BlueCollar.
 * Single source of truth for colors, typography, spacing, radii, and shadows.
 * These values mirror the Tailwind config so they can be used in JS/TS contexts.
 *
 * Usage:
 *   import { colors, typography, spacing } from '@/design-system/tokens'
 *   const bgColor = colors.brand[500]
 *   const fontSize = typography.fontSize.lg
 */

// ============================================================================
// Color Palette
// ============================================================================

export const colors = {
  // Primary brand color (blue)
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
  
  // Neutral colors (grays)
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
  
  // Semantic colors
  success: { light: '#d1fae5', DEFAULT: '#10b981', dark: '#065f46' },
  warning: { light: '#fef3c7', DEFAULT: '#f59e0b', dark: '#92400e' },
  error:   { light: '#fee2e2', DEFAULT: '#ef4444', dark: '#991b1b' },
  info:    { light: '#dbeafe', DEFAULT: '#3b82f6', dark: '#1e40af' },
} as const

// ============================================================================
// Typography
// ============================================================================

export const typography = {
  fontFamily: {
    sans: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: 'var(--font-geist-mono), "Courier New", monospace',
  },
  
  // Font sizes with line heights
  fontSize: {
    xs:   ['0.75rem',  { lineHeight: '1rem' }],      // 12px
    sm:   ['0.875rem', { lineHeight: '1.25rem' }],   // 14px
    base: ['1rem',     { lineHeight: '1.5rem' }],    // 16px
    lg:   ['1.125rem', { lineHeight: '1.75rem' }],   // 18px
    xl:   ['1.25rem',  { lineHeight: '1.75rem' }],   // 20px
    '2xl':['1.5rem',   { lineHeight: '2rem' }],      // 24px
    '3xl':['1.875rem', { lineHeight: '2.25rem' }],   // 30px
    '4xl':['2.25rem',  { lineHeight: '2.5rem' }],    // 36px
    '5xl':['3rem',     { lineHeight: '1' }],         // 48px
  },
  
  // Font weights
  fontWeight: {
    light:    '300',
    normal:   '400',
    medium:   '500',
    semibold: '600',
    bold:     '700',
  },
  
  // Heading styles
  headings: {
    h1: { fontSize: '3rem', fontWeight: '700', lineHeight: '1.2' },
    h2: { fontSize: '2.25rem', fontWeight: '700', lineHeight: '1.2' },
    h3: { fontSize: '1.875rem', fontWeight: '600', lineHeight: '1.3' },
    h4: { fontSize: '1.5rem', fontWeight: '600', lineHeight: '1.4' },
    h5: { fontSize: '1.25rem', fontWeight: '600', lineHeight: '1.4' },
    h6: { fontSize: '1rem', fontWeight: '600', lineHeight: '1.5' },
  },
  
  // Body text styles
  body: {
    large:  { fontSize: '1.125rem', lineHeight: '1.75rem' },
    normal: { fontSize: '1rem', lineHeight: '1.5rem' },
    small:  { fontSize: '0.875rem', lineHeight: '1.25rem' },
  },
  
  // Label styles
  label: {
    large:  { fontSize: '0.875rem', fontWeight: '600', lineHeight: '1.25rem' },
    normal: { fontSize: '0.75rem', fontWeight: '600', lineHeight: '1rem' },
  },
  
  // Caption styles
  caption: {
    large:  { fontSize: '0.875rem', lineHeight: '1.25rem' },
    normal: { fontSize: '0.75rem', lineHeight: '1rem' },
  },
} as const

// ============================================================================
// Spacing Scale
// ============================================================================

export const spacing = {
  0:  '0px',
  1:  '0.25rem',   // 4px
  2:  '0.5rem',    // 8px
  3:  '0.75rem',   // 12px
  4:  '1rem',      // 16px
  5:  '1.25rem',   // 20px
  6:  '1.5rem',    // 24px
  8:  '2rem',      // 32px
  10: '2.5rem',    // 40px
  12: '3rem',      // 48px
  16: '4rem',      // 64px
  20: '5rem',      // 80px
  24: '6rem',      // 96px
} as const

// ============================================================================
// Border Radius
// ============================================================================

export const radii = {
  none: '0px',
  sm:   '0.125rem',  // 2px
  md:   '0.375rem',  // 6px
  lg:   '0.5rem',    // 8px
  xl:   '0.75rem',   // 12px
  '2xl':'1rem',      // 16px
  '3xl':'1.5rem',    // 24px
  full: '9999px',
} as const

// ============================================================================
// Shadows
// ============================================================================

export const shadows = {
  none: 'none',
  sm:  '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md:  '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg:  '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl:  '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
} as const

// ============================================================================
// Transitions
// ============================================================================

export const transitions = {
  fast:     '150ms ease-in-out',
  normal:   '200ms ease-in-out',
  slow:     '300ms ease-in-out',
  slowest:  '500ms ease-in-out',
} as const

// ============================================================================
// Z-Index Scale
// ============================================================================

export const zIndex = {
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
} as const

// ============================================================================
// Breakpoints
// ============================================================================

export const breakpoints = {
  xs: '0px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const

// ============================================================================
// Aggregated Tokens
// ============================================================================

/**
 * The complete, authoritative token set.
 * Prefer importing individual groups (colors, spacing, ...) when only one is
 * needed; use `tokens` when passing the whole set around (e.g. theming).
 */
export const tokens = {
  colors,
  typography,
  spacing,
  radii,
  shadows,
  transitions,
  zIndex,
  breakpoints,
} as const

export type Tokens = typeof tokens
export type ColorToken = keyof typeof colors
export type SpacingToken = keyof typeof spacing
export type RadiusToken = keyof typeof radii
export type ShadowToken = keyof typeof shadows
export type ZIndexToken = keyof typeof zIndex
export type BreakpointToken = keyof typeof breakpoints

export default tokens
