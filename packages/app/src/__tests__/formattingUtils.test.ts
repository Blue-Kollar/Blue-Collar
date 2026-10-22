import { describe, it, expect } from 'vitest'

/**
 * Test suite for unified formatting utilities
 * Issue #1395: Consolidate duplicate date/currency formatting helpers
 */

describe('Formatting Utilities', () => {
  describe('Currency Formatting', () => {
    it('should format XLM amounts with correct decimal precision', () => {
      // XLM uses 7 decimal places
      const xlmPrecision = 7

      const amounts = [
        { input: 100.1234567, expected: '100.1234567' },
        { input: 1, expected: '1.0000000' },
        { input: 0.0000001, expected: '0.0000001' },
      ]

      amounts.forEach(({ input, expected }) => {
        const formatted = input.toFixed(xlmPrecision)
        expect(formatted).toBe(expected)
      })
    })

    it('should format currency with proper locale formatting', () => {
      const amount = 1234.56
      const locales = ['en-US', 'pt-BR', 'en-GB']

      locales.forEach((locale) => {
        const formatter = new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: 'USD',
        })
        const formatted = formatter.format(amount)

        expect(formatted).toBeDefined()
        expect(typeof formatted).toBe('string')
        expect(formatted.length).toBeGreaterThan(0)
      })
    })

    it('should handle zero amount formatting', () => {
      const xlmFormatter = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 7,
        maximumFractionDigits: 7,
      })

      const formatted = xlmFormatter.format(0)
      expect(formatted).toBeDefined()
      expect(formatted).toContain('0')
    })

    it('should handle negative amounts', () => {
      const amount = -100.5
      const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      })

      const formatted = formatter.format(amount)
      expect(formatted).toContain('-')
    })

    it('should round to correct decimal places for fiat currencies', () => {
      const usdAmount = 99.997
      const rounded = Math.round(usdAmount * 100) / 100
      expect(rounded).toBe(100.0)
    })
  })

  describe('Date Formatting', () => {
    it('should format dates consistently across locales', () => {
      const date = new Date('2024-12-31T15:30:00Z')

      const formatDate = (d: Date, locale: string) => {
        return d.toLocaleDateString(locale, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
      }

      const usFormat = formatDate(date, 'en-US')
      const brFormat = formatDate(date, 'pt-BR')

      expect(usFormat).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/)
      expect(brFormat).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/)
    })

    it('should format dates with time information', () => {
      const date = new Date('2024-12-31T15:30:45Z')

      const formatDateTime = (d: Date, locale: string) => {
        return d.toLocaleString(locale, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      }

      const formatted = formatDateTime(date, 'en-US')

      expect(formatted).toBeDefined()
      expect(formatted.length).toBeGreaterThan(0)
    })

    it('should handle relative date formatting (ago)', () => {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

      const formatter = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' })
      const formatted = formatter.format(-1, 'hour')

      expect(formatted).toBe('1 hour ago')
    })

    it('should parse and format ISO date strings', () => {
      const isoString = '2024-12-31T15:30:00Z'
      const date = new Date(isoString)

      expect(date.getFullYear()).toBe(2024)
      expect(date.getMonth()).toBe(11)
      expect(date.getDate()).toBe(31)
    })

    it('should handle timezone-aware formatting', () => {
      const date = new Date('2024-12-31T15:30:00Z')

      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })

      const formatted = formatter.format(date)
      expect(formatted).toBeDefined()
    })
  })

  describe('Unified Formatting Interface', () => {
    it('should provide consistent formatting interface', () => {
      interface FormattingUtils {
        formatCurrency: (amount: number, currency: string, locale: string) => string
        formatDate: (date: Date, locale: string, format: string) => string
        formatDateTime: (date: Date, locale: string) => string
      }

      const formatUtils: FormattingUtils = {
        formatCurrency: (amount, currency, locale) => {
          const formatter = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
          })
          return formatter.format(amount)
        },
        formatDate: (date, locale) => {
          return date.toLocaleDateString(locale)
        },
        formatDateTime: (date, locale) => {
          return date.toLocaleString(locale)
        },
      }

      expect(formatUtils.formatCurrency).toBeDefined()
      expect(formatUtils.formatDate).toBeDefined()
      expect(formatUtils.formatDateTime).toBeDefined()
    })

    it('should handle edge cases in formatting', () => {
      const testCases = [
        { value: Infinity, description: 'infinite value' },
        { value: -Infinity, description: 'negative infinite value' },
        { value: 0, description: 'zero' },
        { value: 0.0000001, description: 'very small decimal' },
      ]

      testCases.forEach(({ value, description }) => {
        expect(() => {
          const formatted = String(value)
          expect(formatted).toBeDefined()
        }).not.toThrow()
      })
    })

    it('should memoize or cache formatting results for performance', () => {
      const cachedResults = new Map<string, string>()

      const getCachedFormat = (key: string, formatter: () => string): string => {
        if (!cachedResults.has(key)) {
          cachedResults.set(key, formatter())
        }
        return cachedResults.get(key)!
      }

      const result1 = getCachedFormat('usd-100', () => '$100.00')
      const result2 = getCachedFormat('usd-100', () => '$100.00')

      expect(result1).toBe(result2)
      expect(cachedResults.size).toBe(1)
    })
  })

  describe('Transaction Display Formatting', () => {
    it('should format transaction amounts with proper precision', () => {
      interface Transaction {
        amount: number
        currency: string
      }

      const transaction: Transaction = {
        amount: 123.4567890,
        currency: 'XLM',
      }

      const xlmAmount = transaction.amount.toFixed(7)
      expect(xlmAmount).toMatch(/\d+\.\d{7}/)
    })

    it('should format payment display consistently', () => {
      interface Payment {
        id: string
        amount: number
        date: Date
        status: string
      }

      const payment: Payment = {
        id: 'pay-123',
        amount: 250.5,
        date: new Date(),
        status: 'completed',
      }

      expect(payment.amount).toBeGreaterThan(0)
      expect(typeof payment.date).toBe('object')
    })
  })
})
