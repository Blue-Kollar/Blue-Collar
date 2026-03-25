import Link from "next/link";
import WorkerCard from "@/components/WorkerCard";
import type { Worker, Category, ApiResponse, Meta } from "@/types";

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
  searchParams: { category?: string; location?: string; search?: string; page?: string };
}

export default async function WorkersPage({ searchParams }: PageProps) {
  const page = searchParams.page ?? "1";
  const params: Record<string, string> = { page, limit: "20" };
  if (searchParams.category) params.category = searchParams.category;
  if (searchParams.location) params.location = searchParams.location;
  if (searchParams.search) params.search = searchParams.search;

  const [{ data: workers, meta }, categories] = await Promise.all([
    fetchWorkers(params),
    fetchCategories(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-bold text-gray-800">Browse Workers</h1>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Sidebar filters */}
        <aside className="w-full shrink-0 lg:w-60">
          <form className="flex flex-col gap-6 rounded-xl border bg-white p-5 shadow-sm">
            {/* Search */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Search
              </label>
              <input
                name="search"
                defaultValue={searchParams.search ?? ""}
                placeholder="Worker name…"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Location */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Location
              </label>
              <input
                name="location"
                defaultValue={searchParams.location ?? ""}
                placeholder="City or area…"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Categories */}
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">Category</p>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="radio"
                    name="category"
                    value=""
                    defaultChecked={!searchParams.category}
                  />
                  All
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
              Apply Filters
            </button>
          </form>
        </aside>

        {/* Results */}
        <div className="flex-1">
          {workers.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border bg-white py-20 text-center shadow-sm">
              <p className="text-lg font-semibold text-gray-700">No workers found</p>
              <p className="mt-1 text-sm text-gray-500">
                Try broadening your search or removing some filters.
              </p>
              <Link
                href="/workers"
                className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Clear filters
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {workers.map((w) => (
                  <WorkerCard key={w.id} worker={w} />
                ))}
              </div>

              {/* Pagination */}
              {meta && meta.pages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  {Array.from({ length: meta.pages }, (_, i) => i + 1).map((p) => {
                    const sp = new URLSearchParams({
                      ...params,
                      page: String(p),
                    });
                    return (
                      <Link
                        key={p}
                        href={`/workers?${sp.toString()}`}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium border transition-colors ${
                          p === meta.page
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {p}
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
