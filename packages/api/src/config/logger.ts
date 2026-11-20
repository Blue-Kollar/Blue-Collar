import pino from 'pino'
import { config } from './config'

const isDev = config.nodeEnv !== 'production'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'bluecollar-api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      'token',
      '*.password',
      '*.token',
      // Nested objects and common credential names (#1829)
      '*.*.password',
      '*.*.token',
      '*.secret',
      '*.*.secret',
      '*.apiKey',
      '*.accessToken',
      '*.refreshToken',
      '*.privateKey',
      'req.body.password',
      'req.body.token',
    ],
    censor: '[REDACTED]',
  },
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, ignore: 'pid,hostname' },
    },
  }),
})