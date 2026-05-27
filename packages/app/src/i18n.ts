import { getRequestConfig } from 'next-intl/server'
import { defaultLocale, isLocale } from './lib/i18n'

export default getRequestConfig(async ({ locale }) => {
  const activeLocale = locale && isLocale(locale) ? locale : defaultLocale

  return {
    locale: activeLocale,
    messages: (await import(`./messages/${activeLocale}.json`)).default
  }
})
