import pinoHttp from 'pino-http'
import pino from 'pino'
import fs from 'node:fs'
import path from 'node:path'

const LOG_DIR = process.env.LOG_DIR ?? 'storage/logs'
fs.mkdirSync(path.resolve(LOG_DIR), { recursive: true })

const isDev = process.env.NODE_ENV !== 'production'

/**
 * Pino-http middleware that logs every request with:
 * - method, url, status, response time
 * - user agent, IP address
 * - authenticated user id (if present)
 *
 * In production, logs are written to a daily rotating file via pino/file.
 * In development, pretty-printed to stdout.
 */
export const requestLogger = pinoHttp({
  logger: isDev
    ? pino({ level: 'info', transport: { target: 'pino-pretty', options: { colorize: true, ignore: 'pid,hostname' } } })
    : pino(
        { level: 'info' },
        pino.destination({
          dest: path.resolve(LOG_DIR, `api-${new Date().toISOString().slice(0, 10)}.log`),
          sync: false,
        }),
      ),

  customProps: (req: any) => ({
    userAgent: req.headers['user-agent'],
    ip: req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress,
    userId: req.user?.id ?? null,
  }),

  customSuccessMessage: (req: any, res) => `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req: any, res, err) => `${req.method} ${req.url} ${res.statusCode} — ${err.message}`,

  serializers: {
    req: (req) => ({ method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
})
