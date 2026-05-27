import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { localizedPath } from '@/lib/i18n'

interface Category {
  id: string
  name: string
  icon: string | null
  _count: { workers: number }
}

async function getCategories(): Promise<Category[]> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return [];
  const res = await fetch(`${base}/api/categories`, { cache: "force-cache" });
  if (!res.ok) return [];
  const json = await res.json();
  return json.data;
}

export default async function Categories() {
  const locale = await getLocale()
  const t = await getTranslations('homePage.categories')
  const categories = await getCategories()

  return (
    <section>
      <h2>{t('title')}</h2>
      <div className="categories-grid">
        {categories.map((cat) => (
          <Link key={cat.id} href={`${localizedPath('/workers', locale)}?category=${cat.id}`} className="category-card">
            {cat.icon && <span className="category-icon">{cat.icon}</span>}
            <span className="category-name">{cat.name}</span>
            <span className="category-badge">{t('workerCount', { count: cat._count.workers })}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function CategoriesSkeleton() {
  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 h-7 w-48 animate-pulse rounded-md bg-gray-200 dark:bg-gray-700" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-800 p-5" aria-hidden="true">
              <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-14 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
