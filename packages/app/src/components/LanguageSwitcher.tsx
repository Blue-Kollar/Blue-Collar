"use client"

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { localeLabels, locales, switchLocalePath } from '@/lib/i18n'
import { Button } from './ui/button'

export function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const handleLanguageChange = (newLocale: string) => {
    router.push(switchLocalePath(pathname, locale, newLocale))
  }

  return (
    <div className="flex gap-2">
      {locales.map(code => (
        <Button
          key={code}
          variant={locale === code ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleLanguageChange(code)}
        >
          {localeLabels[code]}
        </Button>
      ))}
    </div>
  )
}
