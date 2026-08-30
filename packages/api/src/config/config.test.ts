import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// Helpers that mirror the config module's internal logic (tested in isolation
// so we don't need to reload the module with different env vars each time).

function required(env: Record<string, string | undefined>, key: string): string {
  const value = env[key]
  if (!value) throw new Error(`Config error: required env var "${key}" is missing or empty`)
  return value
}

function optionalInt(env: Record<string, string | undefined>, key: string, fallback: number): number {
  const raw = env[key]
  if (!raw) return fallback
  const parsed = parseInt(raw, 10)
  if (isNaN(parsed)) throw new Error(`Config error: "${key}" must be an integer, got "${raw}"`)
  return parsed
}

function optionalBool(env: Record<string, string | undefined>, key: string, fallback: boolean): boolean {
  const raw = env[key]
  if (!raw) return fallback
  if (raw === 'true' || raw === '1') return true
  if (raw === 'false' || raw === '0') return false
  throw new Error(`Config error: "${key}" must be true/false/1/0, got "${raw}"`)
}

describe('Config validation helpers', () => {
  describe('required()', () => {
    it('returns value when present', () => {
      expect(required({ KEY: 'value' }, 'KEY')).toBe('value')
    })

    it('throws when missing', () => {
      expect(() => required({}, 'KEY')).toThrow('required env var "KEY" is missing or empty')
    })

    it('throws when empty string', () => {
      expect(() => required({ KEY: '' }, 'KEY')).toThrow('required env var "KEY" is missing or empty')
    })
  })

  describe('optionalInt()', () => {
    it('returns parsed integer', () => {
      expect(optionalInt({ PORT: '4000' }, 'PORT', 3000)).toBe(4000)
    })

    it('returns fallback when missing', () => {
      expect(optionalInt({}, 'PORT', 3000)).toBe(3000)
    })

    it('throws on non-integer value', () => {
      expect(() => optionalInt({ PORT: 'abc' }, 'PORT', 3000)).toThrow('must be an integer')
    })
  })

  describe('optionalBool()', () => {
    it.each([['true', true], ['1', true], ['false', false], ['0', false]])(
      'parses "%s" as %s',
      (raw, expected) => {
        expect(optionalBool({ FLAG: raw }, 'FLAG', false)).toBe(expected)
      }
    )

    it('returns fallback when missing', () => {
      expect(optionalBool({}, 'FLAG', true)).toBe(true)
    })

    it('throws on invalid value', () => {
      expect(() => optionalBool({ FLAG: 'yes' }, 'FLAG', false)).toThrow('must be true/false/1/0')
    })
  })
})

describe('Config structure', () => {
  it('config module exports expected top-level keys', async () => {
    // Dynamically import after setting required env vars
    const saved = { ...process.env }
    process.env.DATABASE_URL = 'postgresql://x'
    process.env.JWT_SECRET = 'secret'
    process.env.APP_URL = 'http://localhost:3001'
    process.env.GOOGLE_CLIENT_ID = 'gid'
    process.env.GOOGLE_CLIENT_SECRET = 'gsecret'
    process.env.MAIL_HOST = 'smtp.example.com'
    process.env.MAIL_USER = 'user@example.com'
    process.env.MAIL_PASS = 'pass'

    // Re-import with a cache-busting query to get a fresh module
    const { config } = await import(`./config.js?t=${Date.now()}`)

    expect(config).toHaveProperty('env')
    expect(config).toHaveProperty('port')
    expect(config).toHaveProperty('db')
    expect(config).toHaveProperty('auth')
    expect(config).toHaveProperty('mail')
    expect(config).toHaveProperty('redis')
    expect(config).toHaveProperty('upload')
    expect(config.port).toBe(3000)

    // Restore
    Object.keys(process.env).forEach(k => { if (!(k in saved)) delete process.env[k] })
    Object.assign(process.env, saved)
  })
})
