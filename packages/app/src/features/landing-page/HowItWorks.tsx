'use client'

import { useEffect, useRef, useState } from 'react'

const steps = [
  {
    icon: '🔍',
    title: 'Search for a Skill',
    description: 'Browse categories or search by skill and location to find the right tradesperson.',
  },
  {
    icon: '✅',
    title: 'Find a Verified Worker',
    description: 'Every listing is community-curated and anchored on-chain for transparency.',
  },
  {
    icon: '⛓️',
    title: 'Pay Securely On-Chain',
    description: 'Send tips and payments directly to workers via Stellar — no middlemen.',
  },
]

function Step({ icon, title, description, index }: (typeof steps)[0] & { index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
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
      <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-gray-500 max-w-xs">{description}</p>
    </div>
  )
}

export default function HowItWorks() {
  return (
    <section className="px-4 py-16 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-center text-gray-900 sm:text-3xl">How It Works</h2>
        <div className="mt-12 grid gap-10 sm:grid-cols-3">
          {steps.map((step, i) => (
            <Step key={step.title} {...step} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
