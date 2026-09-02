'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

export default function Hero() {
  const router = useRouter()
  const t = useTranslations('hero')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (location) params.set('location', location)
    router.push(`/workers?${params.toString()}`)
  }

  return (
    <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white px-4 py-24 sm:py-32 text-center">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
          {t('title')}
        </h1>
        <p className="text-lg sm:text-xl text-blue-100 mb-8 max-w-2xl mx-auto leading-relaxed">
          {t('subtitle')}
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center max-w-2xl mx-auto mb-8"
        >
          <input
            type="text"
            placeholder={t('categoryPlaceholder')}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="flex-1 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-300"
            aria-label={t('ariaCategory')}
          />
          <input
            type="text"
            placeholder={t('locationPlaceholder')}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="flex-1 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-300"
            aria-label={t('ariaLocation')}
          />
          <button
            type="submit"
            className="rounded-lg bg-white text-blue-700 font-semibold px-6 py-3 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {t('browseWorkers')}
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-2 bg-white text-blue-700 font-semibold px-6 py-3 rounded-lg hover:bg-blue-50 transition-colors"
          >
            {t('getStarted')}
            <ArrowRight size={18} />
          </Link>
          <Link
            href="/workers"
            className="inline-flex items-center gap-2 border-2 border-white text-white font-semibold px-6 py-3 rounded-lg hover:bg-white/10 transition-colors"
          >
            {t('browseAll')}
          </Link>
        </div>
      </div>
    </section>
  )
}
