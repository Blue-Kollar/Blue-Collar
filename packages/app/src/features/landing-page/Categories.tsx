import Link from 'next/link'

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
  const categories = await getCategories()

  return (
    <section>
      <h2>Browse by Category</h2>
      <div className="categories-grid">
        {categories.map((cat) => (
          <Link key={cat.id} href={`/workers?category=${cat.id}`} className="category-card">
            {cat.icon && <span className="category-icon">{cat.icon}</span>}
            <span className="category-name">{cat.name}</span>
            <span className="category-badge">{cat._count.workers} workers</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function CategoriesSkeleton() {
  return (
    <section>
      <h2>Browse by Category</h2>
      <div className="categories-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="category-card skeleton" aria-hidden="true">
            <span className="category-icon skeleton-box" />
            <span className="category-name skeleton-box" />
            <span className="category-badge skeleton-box" />
          </div>
        ))}
      </div>
    </section>
  )
}
