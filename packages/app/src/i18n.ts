import { getRequestConfig } from 'next-intl/server'
import { logger } from './lib/logger'

export default getRequestConfig(async ({ locale }) => ({
  locale: locale ?? 'en',
  messages: (await import(`./messages/${locale}.json`)).default,
  onError(error) {
    if (error.code === 'MISSING_MESSAGE') {
      logger.warn(`[i18n] Missing message: ${error.message}`)
      return
    }
    logger.error(error)
  },
  getMessageFallback({ namespace, key, error }) {
    const path = [namespace, key].filter(Boolean).join('.')
    if (error.code === 'MISSING_MESSAGE') {
      return path
    }
    return path
  }
}))