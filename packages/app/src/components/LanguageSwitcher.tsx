import { useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from './ui/button'

export function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'Français' },
    { code: 'es', label: 'Español' }
  ]

  const handleLanguageChange = (newLocale: string) => {
    const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`)
    router.push(newPathname)
  }

  return (
    <div className="flex gap-2">
      {languages.map(lang => (
        <Button
          key={lang.code}
          variant={locale === lang.code ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleLanguageChange(lang.code)}
        >
          {lang.label}
        </Button>
      ))}
    </div>
  )
}
