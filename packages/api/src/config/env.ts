/**
 * Legacy env module — kept for backward compatibility.
 * New code should import from './config.js' directly.
 */
import { config } from './config.js'

export const env = {
  DATABASE_URL:         config.db.url,
  JWT_SECRET:           config.auth.jwtSecret,
  PORT:                 config.port,
  GOOGLE_CLIENT_ID:     config.auth.googleClientId,
  GOOGLE_CLIENT_SECRET: config.auth.googleClientSecret,
  MAIL_HOST:            config.mail.host,
  MAIL_PORT:            config.mail.port,
  MAIL_USER:            config.mail.user,
  MAIL_PASS:            config.mail.pass,
  APP_URL:              config.appUrl,
  REDIS_URL:            config.redis.url,
  HORIZON_URL:          config.stellar.horizonUrl,
  ALLOWED_ORIGINS:      config.allowedOrigins,
  LOG_LEVEL:            config.logLevel,
} as const

export default env