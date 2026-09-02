"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import type { Category } from "@/types";

import type { FilterValues } from "./FilterPanel";

interface ActiveFiltersProps {
  filters: FilterValues;
  search: string;
  categories: Category[];
  onRemoveFilter: (key: keyof FilterValues) => void;
  onClearSearch: () => void;
}

export default function ActiveFilters({
  filters,
  search,
  categories,
  onRemoveFilter,
  onClearSearch,
}: ActiveFiltersProps) {
  const t = useTranslations("filters");
  const chips: { label: string; onRemove: () => void }[] = [];

  if (search) {
    chips.push({ label: t("activeSearch", { query: search }), onRemove: onClearSearch });
  }
  if (filters.category) {
    const cat = categories.find((c) => c.id === filters.category);
    chips.push({
      label: t("activeCategory", { name: cat?.name ?? filters.category }),
      onRemove: () => onRemoveFilter("category"),
    });
  }
  if (filters.city) {
    chips.push({
      label: t("activeCity", { name: filters.city }),
      onRemove: () => onRemoveFilter("city"),
    });
  }
  if (filters.state) {
    chips.push({
      label: t("activeState", { name: filters.state }),
      onRemove: () => onRemoveFilter("state"),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span
          key={chip.label}
          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            className="rounded-full p-0.5 hover:bg-blue-100"
            aria-label={t("removeFilter", { label: chip.label })}
          >
            <X size={12} />
          </button>
        </span>
      ))}
    </div>
  );
}
