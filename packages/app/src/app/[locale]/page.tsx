import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Hero from '@/features/landing-page/Hero'
import Categories, { CategoriesSkeleton } from '@/features/landing-page/Categories'
import HowItWorks from '@/features/landing-page/HowItWorks'
import FeaturedWorkers, { FeaturedWorkersSkeleton } from '@/features/landing-page/FeaturedWorkers'

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Suspense fallback={<CategoriesSkeleton />}>
          <Categories />
        </Suspense>
        <Suspense fallback={<FeaturedWorkersSkeleton />}>
          <FeaturedWorkers />
        </Suspense>
        <HowItWorks />
      </main>
      <Footer />
    </>
  )
}
