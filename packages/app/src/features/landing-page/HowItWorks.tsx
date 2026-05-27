'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

interface StepData {
  icon: string
  title: string
  description: string
}

function Step({ icon, title, description, index }: StepData & { index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.2 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${index * 150}ms` }}
      className={`flex flex-col items-center text-center transition-all duration-700 ease-out
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
    >
      <span className="text-5xl">{icon}</span>
      <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-xs">{description}</p>
    </div>
  )
}

export default function HowItWorks() {
  const t = useTranslations('homePage.howItWorks')
  const steps = [
    {
      icon: '🔍',
      title: t('steps.search.title'),
      description: t('steps.search.description'),
    },
    {
      icon: '✅',
      title: t('steps.verified.title'),
      description: t('steps.verified.description'),
    },
    {
      icon: '⛓️',
      title: t('steps.pay.title'),
      description: t('steps.pay.description'),
    },
  ]

  return (
    <section className="px-4 py-16 bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 sm:text-3xl">{t('title')}</h2>
        <div className="mt-12 grid gap-10 sm:grid-cols-3">
          {steps.map((step, i) => (
            <Step key={step.title} {...step} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
