import pino from 'pino'
import { config } from './config'

const isDev = config.nodeEnv !== 'production'

export const logger = pino({
  level: config.logLevel,
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, ignore: 'pid,hostname' },
    },
  }),
})