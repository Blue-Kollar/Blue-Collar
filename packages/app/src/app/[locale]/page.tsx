import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Hero from '@/features/landing-page/Hero'
import Categories from '@/features/landing-page/Categories'
import HowItWorks from '@/features/landing-page/HowItWorks'
import FeaturedWorkers from '@/features/landing-page/FeaturedWorkers'

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Categories />
        <FeaturedWorkers />
        <HowItWorks />
      </main>
      <Footer />
    </>
  )
}
