import { Suspense } from 'react';
import { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Hero from '@/features/landing-page/Hero';
import Categories, { CategoriesSkeleton } from '@/features/landing-page/Categories';
import HowItWorks from '@/features/landing-page/HowItWorks';
import FeaturedWorkers, { FeaturedWorkersSkeleton } from '@/features/landing-page/FeaturedWorkers';
import Testimonials from '@/features/landing-page/Testimonials';

export const metadata: Metadata = {
  title: 'BlueCollar - Find Skilled Workers Near You',
  description:
    'Connect with trusted local tradespeople. Find plumbers, electricians, carpenters, and more skilled workers in your area. Secure payments on Stellar blockchain.',
  keywords: [
    'skilled workers',
    'tradespeople',
    'plumber',
    'electrician',
    'carpenter',
    'local services',
    'blockchain',
  ],
  openGraph: {
    title: 'BlueCollar - Find Skilled Workers Near You',
    description: 'Connect with trusted local tradespeople through a decentralized platform.',
    type: 'website',
    url: 'https://bluecollar.app',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'BlueCollar - Find Skilled Workers',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BlueCollar - Find Skilled Workers Near You',
    description: 'Connect with trusted local tradespeople through a decentralized platform.',
    images: ['/og-image.png'],
  },
};

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <div className="min-h-[320px]">
          <Suspense fallback={<CategoriesSkeleton />}>
            <Categories />
          </Suspense>
        </div>
        <div className="min-h-[520px]">
          <Suspense fallback={<FeaturedWorkersSkeleton />}>
            <FeaturedWorkers />
          </Suspense>
        </div>
        <HowItWorks />
        <Testimonials />
      </main>
      <Footer />
    </>
  );
}
