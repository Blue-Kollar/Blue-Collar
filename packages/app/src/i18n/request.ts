import { getRequestConfig } from 'next-intl/server'

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`../messages/${locale}.json`)).default,
  onError(error) {
    if (error.code === 'MISSING_MESSAGE') {
      console.warn(`[i18n] Missing message: ${error.message}`)
      return
    }
    console.error(error)
  },
  getMessageFallback({ namespace, key, error }) {
    const path = [namespace, key].filter(Boolean).join('.')
    if (error.code === 'MISSING_MESSAGE') {
      return path
    }
    return path
  }
}))
