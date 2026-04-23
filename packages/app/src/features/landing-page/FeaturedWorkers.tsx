import Image from 'next/image'
import Link from 'next/link'

interface Worker {
  id: string
  name: string
  avatar: string | null
  category: { name: string }
}

async function getFeaturedWorkers(): Promise<Worker[]> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return [];
  const res = await fetch(`${base}/api/workers?limit=6`, { cache: "force-cache" });
  if (!res.ok) return [];
  const json = await res.json();
  return json.data;
}

export function FeaturedWorkersSkeleton() {
  return (
    <section className="px-4 py-16 max-w-6xl mx-auto">
      <div className="h-8 w-48 animate-pulse rounded-md bg-gray-200 dark:bg-gray-700" />
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full animate-pulse bg-gray-200 dark:bg-gray-700 shrink-0" />
              <div className="flex flex-col gap-2 flex-1">
                <div className="h-4 w-28 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-3 w-16 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
              </div>
            </div>
            <div className="mt-auto h-9 w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function FeaturedWorkers() {
  const workers = await getFeaturedWorkers()

  return (
    <section className="px-4 py-16 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Featured Workers</h2>

      {workers.length === 0 ? (
        <p className="mt-6 text-gray-500">No workers available yet. Check back soon.</p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {workers.map((worker) => (
            <div key={worker.id} className="rounded-xl border border-gray-200 p-5 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                {worker.avatar ? (
                  <Image
                    src={worker.avatar}
                    alt={worker.name}
                    width={56}
                    height={56}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl">
                    {worker.name.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-gray-900">{worker.name}</p>
                  <span className="inline-block mt-1 text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {worker.category.name}
                  </span>
                </div>
              </div>
              <Link
                href={`/workers/${worker.id}`}
                className="mt-auto text-center rounded-lg border border-blue-700 text-blue-700 font-medium py-2 hover:bg-blue-50 transition-colors"
              >
                View Profile
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className="mt-10 text-center">
        <Link
          href="/workers"
          className="inline-block rounded-lg bg-blue-700 text-white font-semibold px-8 py-3 hover:bg-blue-800 transition-colors"
        >
          See All Workers
        </Link>
      </div>
    </section>
  )
}
