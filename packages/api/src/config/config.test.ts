import { describe, it, expect } from 'vitest'
import { loadConfig } from './config.js'

const requiredEnv = {
  DATABASE_URL: 'postgresql://localhost:5432/bluecollar',
  JWT_SECRET: 'test-secret',
  APP_URL: 'http://localhost:3001',
  GOOGLE_CLIENT_ID: 'google-id',
  GOOGLE_CLIENT_SECRET: 'google-secret',
  MAIL_HOST: 'smtp.example.com',
  MAIL_USER: 'user@example.com',
  MAIL_PASS: 'pass',
}

describe('loadConfig', () => {
  it('maps required env vars into the typed config object', () => {
    const config = loadConfig(requiredEnv)

    expect(config.env).toBe('development')
    expect(config.port).toBe(3000)
    expect(config.appUrl).toBe('http://localhost:3001')
    expect(config.db.url).toBe('postgresql://localhost:5432/bluecollar')
    expect(config.auth.jwtSecret).toBe('test-secret')
    expect(config.mail.port).toBe(587)
    expect(config.redis.url).toBe('redis://localhost:6379')
    expect(config.upload.dir).toBe('storage/uploads')
    expect(config.upload.maxFileSize).toBe(5_242_880)
  })

  it('throws when a required variable is missing', () => {
    const { APP_URL: _omitted, ...withoutAppUrl } = requiredEnv

    expect(() => loadConfig(withoutAppUrl)).toThrow(/APP_URL/)
  })

  it('throws when a required variable is empty', () => {
    expect(() => loadConfig({ ...requiredEnv, JWT_SECRET: '' })).toThrow(/JWT_SECRET/)
  })

  it('parses integers and rejects non-integers', () => {
    expect(loadConfig({ ...requiredEnv, PORT: '4000' }).port).toBe(4000)
    expect(() => loadConfig({ ...requiredEnv, PORT: 'abc' })).toThrow(/PORT/)
    expect(() => loadConfig({ ...requiredEnv, PORT: '-1' })).toThrow(/PORT/)
  })

  it('validates NODE_ENV against the allowed values', () => {
    expect(loadConfig({ ...requiredEnv, NODE_ENV: 'test' }).env).toBe('test')
    expect(() => loadConfig({ ...requiredEnv, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/)
  })

  it('splits and trims comma-separated CORS origins', () => {
    const config = loadConfig({
      ...requiredEnv,
      ALLOWED_ORIGINS: 'http://a.test, http://b.test',
    })

    expect(config.allowedOrigins).toEqual(['http://a.test', 'http://b.test'])
  })

  it('applies defaults for empty optional values', () => {
    const config = loadConfig({ ...requiredEnv, REDIS_URL: '', PORT: '', VAULT_TOKEN: '' })

    expect(config.redis.url).toBe('redis://localhost:6379')
    expect(config.port).toBe(3000)
    expect(config.vault.token).toBeUndefined()
  })

  it('does not leak unrelated environment variables', () => {
    const config = loadConfig({ ...requiredEnv, UNRELATED: 'value' })

    expect(config).not.toHaveProperty('UNRELATED')
  })
})
