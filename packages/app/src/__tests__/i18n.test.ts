import { describe, expect, it } from 'vitest'
import { defaultLocale, isLocale, localizedPath, localeLabels, locales, switchLocalePath } from '@/lib/i18n'

describe('i18n routing helpers', () => {
  it('includes English and Portuguese locale support', () => {
    expect(defaultLocale).toBe('en')
    expect(locales).toContain('en')
    expect(locales).toContain('pt')
    expect(localeLabels.pt).toBe('Português')
  })

  it('validates supported locales', () => {
    expect(isLocale('pt')).toBe(true)
    expect(isLocale('de')).toBe(false)
  })

  it('builds locale-prefixed paths', () => {
    expect(localizedPath('/', 'pt')).toBe('/pt')
    expect(localizedPath('/workers', 'pt')).toBe('/pt/workers')
  })

  it('switches the locale segment while preserving the route', () => {
    expect(switchLocalePath('/en/workers?category=plumber', 'en', 'pt')).toBe('/pt/workers?category=plumber')
    expect(switchLocalePath('/en', 'en', 'pt')).toBe('/pt')
  })
})
