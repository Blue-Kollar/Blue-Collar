"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import WorkerCard from "@/components/WorkerCard";
import { WorkerCardSkeleton } from "@/components/Skeleton";
import ErrorState from "@/components/ErrorState";
import Pagination from "@/components/Pagination";
import SearchInput from "@/components/Search/SearchInput";
import FilterPanel, {
  EMPTY_FILTERS,
  type FilterValues,
} from "@/components/Filters/FilterPanel";
import ActiveFilters from "@/components/Filters/ActiveFilters";
import MobileFilterSheet from "@/components/Filters/MobileFilterSheet";
import { useDebounce } from "@/hooks/useDebounce";
import { getWorkers, getCategories } from "@/lib/api";
import type { Worker, Category, Meta } from "@/types";

const LIMIT = 20;

function filtersFromParams(sp: URLSearchParams): FilterValues {
  return {
    category: sp.get("category") ?? "",
    city: sp.get("city") ?? "",
    state: sp.get("state") ?? "",
  };
}

function paramsFromState(
  search: string,
  filters: FilterValues,
  page: number
): Record<string, string> {
  const p: Record<string, string> = {
    page: String(page),
    limit: String(LIMIT),
  };
  if (search) p.search = search;
  if (filters.category) p.category = filters.category;
  if (filters.city) p.city = filters.city;
  if (filters.state) p.state = filters.state;
  return p;
}

export default function WorkersDiscovery() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("workersDiscovery");
  const commonT = useTranslations("common");

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [filters, setFilters] = useState<FilterValues>(
    filtersFromParams(searchParams)
  );
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 350);

  useEffect(() => {
    getCategories()
      .then((res) => setCategories(res.data))
      .catch(() => {});
  }, []);

  const syncUrl = useCallback(
    (s: string, f: FilterValues, p: number) => {
      const params = paramsFromState(s, f, p);
      const qs = new URLSearchParams(params).toString();
      router.replace(`/workers?${qs}`, { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    let cancelled = false;
    const params = paramsFromState(debouncedSearch, filters, page);

    setLoading(true);
    setError(null);

    syncUrl(debouncedSearch, filters, page);

    getWorkers(params)
      .then((res) => {
        if (cancelled) return;
        setWorkers(res.data);
        setMeta(res.meta);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load workers");
        setWorkers([]);
        setMeta(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, filters, page, syncUrl]);

  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    setPage(1);
  }, []);

  const handleFilterChange = useCallback((f: FilterValues) => {
    setFilters(f);
    setPage(1);
  }, []);

  const handleFilterReset = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }, []);

  const handleRemoveFilter = useCallback(
    (key: keyof FilterValues) => {
      setFilters((prev) => ({ ...prev, [key]: "" }));
      setPage(1);
    },
    []
  );

  const resultCount = meta?.total ?? 0;

  const gridMinHeight = useMemo(() => {
    if (loading) return "min-h-[600px]";
    return workers.length > 0 ? "min-h-[200px]" : "";
  }, [loading, workers.length]);

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-24">
          <FilterPanel
            filters={filters}
            categories={categories}
            onChange={handleFilterChange}
            onReset={handleFilterReset}
            loading={loading}
          />
        </div>
      </aside>

      <div className="flex-1">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <SearchInput
              value={search}
              onChange={handleSearch}
              placeholder={t("searchPlaceholder")}
            />
          </div>
          <MobileFilterSheet
            filters={filters}
            categories={categories}
            onChange={handleFilterChange}
            onReset={handleFilterReset}
            loading={loading}
          />
        </div>

        <ActiveFilters
          filters={filters}
          search={debouncedSearch}
          categories={categories}
          onRemoveFilter={handleRemoveFilter}
          onClearSearch={() => handleSearch("")}
        />

        {!loading && !error && (
          <p className="mb-4 mt-2 text-sm text-gray-500" role="status" aria-live="polite">
            {resultCount === 0
              ? t("noResults")
              : t("resultsFound", { count: resultCount })}
          </p>
        )}

        {error && (
          <ErrorState
            title={t("errorTitle")}
            message={error}
            onRetry={() => setPage(page)}
            retryLabel={commonT("tryAgain")}
          />
        )}

        {loading && (
          <div
            className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 ${gridMinHeight}`}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <WorkerCardSkeleton key={i} />
            ))}
          </div>
        )}

        {!loading && !error && workers.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border bg-white py-20 text-center shadow-sm">
            <p className="text-lg font-semibold text-gray-700">
              {t("emptyTitle")}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {t("emptyDescription")}
            </p>
            <button
              type="button"
              onClick={() => {
                handleSearch("");
                handleFilterReset();
              }}
              className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {t("clearAllFilters")}
            </button>
          </div>
        )}

        {!loading && !error && workers.length > 0 && (
          <>
            <div
              className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 ${gridMinHeight}`}
            >
              {workers.map((w) => (
                <WorkerCard key={w.id} worker={w} />
              ))}
            </div>

            {meta && meta.pages > 1 && (
              <div className="mt-8">
                <Pagination
                  page={meta.page}
                  pages={meta.pages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
