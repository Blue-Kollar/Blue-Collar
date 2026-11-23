import type { Metadata } from 'next';
import { Suspense } from 'react';
import WorkersDiscovery from '@/components/WorkersDiscovery';
import { WorkersDiscoveryFallback } from '@/components/workers/WorkersDiscoveryFallback';

export const metadata: Metadata = {
  title: 'Browse Workers',
  description: 'Find skilled tradespeople near you — plumbers, electricians, carpenters and more.',
  openGraph: {
    title: 'Browse Workers | BlueCollar',
    description: 'Find skilled tradespeople near you.',
  },
};

export default function WorkersPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-bold text-gray-800">Browse Workers</h1>
      <Suspense fallback={<WorkersDiscoveryFallback />}>
        <WorkersDiscovery />
      </Suspense>
    </div>
  );
}
