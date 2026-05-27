'use client'

import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { localizedPath } from '@/lib/i18n'

export default function Hero() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('homePage.hero')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (location) params.set('location', location)
    const query = params.toString()
    router.push(`${localizedPath('/workers', locale)}${query ? `?${query}` : ''}`)
  }

  return (
    <section className="bg-blue-700 text-white px-4 py-20 text-center">
      <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
        {t('title')}
      </h1>
      <p className="mt-4 text-lg text-blue-100 sm:text-xl max-w-xl mx-auto">
        {t('description')}
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center max-w-2xl mx-auto"
      >
        <input
          type="text"
          placeholder={t('categoryPlaceholder')}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="flex-1 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <input
          type="text"
          placeholder={t('locationPlaceholder')}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="flex-1 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <button
          type="submit"
          className="rounded-lg bg-white text-blue-700 font-semibold px-6 py-3 hover:bg-blue-50 transition-colors"
        >
          {t('browseWorkers')}
        </button>
      </form>
    </section>
  )
}
