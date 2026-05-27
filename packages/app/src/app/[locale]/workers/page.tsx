import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import WorkerInfiniteList from "@/components/WorkerInfiniteList";
import SearchAutocomplete from "@/components/SearchAutocomplete";
import { localizedPath } from "@/lib/i18n";
import type { Worker, Category, ApiResponse } from "@/types";

export const metadata: Metadata = {
  title: "Browse Workers",
  description: "Find skilled tradespeople near you — plumbers, electricians, carpenters and more.",
  openGraph: {
    title: "Browse Workers | BlueCollar",
    description: "Find skilled tradespeople near you.",
  },
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

async function fetchWorkers(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API}/workers?${qs}`, { cache: "no-store" });
  if (!res.ok) return { data: [] as Worker[], meta: null };
  const json: ApiResponse<Worker[]> = await res.json();
  return { data: json.data, meta: json.meta ?? null };
}

async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API}/categories`, { cache: "force-cache" } as RequestInit);
  if (!res.ok) return [];
  const json: ApiResponse<Category[]> = await res.json();
  return json.data;
}

interface PageProps {
  searchParams: {
    category?: string
    location?: string
    search?: string
    page?: string
    minRating?: string
    available?: string
    listedSince?: string
  }
}

export default async function WorkersPage({ searchParams }: PageProps) {
  const locale = await getLocale()
  const t = await getTranslations('workers.page')
  const days = [
    t('days.sun'),
    t('days.mon'),
    t('days.tue'),
    t('days.wed'),
    t('days.thu'),
    t('days.fri'),
    t('days.sat'),
  ]
  const page = searchParams.page ?? "1"
  const params: Record<string, string> = { page, limit: "20" }
  if (searchParams.category) params.category = searchParams.category
  if (searchParams.location) params.location = searchParams.location
  if (searchParams.search) params.search = searchParams.search
  if (searchParams.minRating) params.minRating = searchParams.minRating
  if (searchParams.available) params.available = searchParams.available
  if (searchParams.listedSince) params.listedSince = searchParams.listedSince

  const [{ data: workers, meta }, categories] = await Promise.all([
    fetchWorkers(params),
    fetchCategories(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-bold text-gray-800">{t('title')}</h1>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Sidebar filters */}
        <aside className="w-full shrink-0 lg:w-60">
          <form className="flex flex-col gap-6 rounded-xl border bg-white p-5 shadow-sm">
            {/* Search */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{t('search')}</label>
              <SearchAutocomplete
                name="search"
                defaultValue={searchParams.search ?? ""}
                placeholder={t('searchPlaceholder')}
              />
            </div>

            {/* Location */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{t('location')}</label>
              <input
                name="location"
                defaultValue={searchParams.location ?? ""}
                placeholder={t('locationPlaceholder')}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Min Rating */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {t('minRating')}
              </label>
              <select
                name="minRating"
                defaultValue={searchParams.minRating ?? ""}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('any')}</option>
                {[1, 2, 3, 4, 5].map((r) => (
                  <option key={r} value={r}>{"★".repeat(r)} {t('ratingOption', { rating: r })}</option>
                ))}
              </select>
            </div>

            {/* Availability */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {t('availableOn')}
              </label>
              <select
                name="available"
                defaultValue={searchParams.available ?? ""}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('anyDay')}</option>
                {days.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>

            {/* Listed Since (experience proxy) */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {t('listedWithin')}
              </label>
              <select
                name="listedSince"
                defaultValue={searchParams.listedSince ?? ""}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('anyTime')}</option>
                <option value="1">{t('lastYear')}</option>
                <option value="2">{t('lastYears', { count: 2 })}</option>
                <option value="5">{t('lastYears', { count: 5 })}</option>
              </select>
            </div>

            {/* Categories */}
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">{t('category')}</p>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="radio" name="category" value="" defaultChecked={!searchParams.category} />
                  {t('all')}
                </label>
                {categories.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="radio"
                      name="category"
                      value={c.id}
                      defaultChecked={searchParams.category === c.id}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {t('applyFilters')}
            </button>
            <Link
              href={localizedPath('/workers', locale)}
              className="text-center text-xs text-gray-400 hover:text-gray-600"
            >
              {t('clearAll')}
            </Link>
          </form>
        </aside>

          {/* Results */}
          <div className="flex-1">
            <WorkerInfiniteList
              initialWorkers={workers}
              initialMeta={meta}
              params={params}
            />
          </div>
      </div>
    </div>
  );
}
