"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";

import type { Category } from "@/types";

export interface FilterValues {
  category: string;
  city: string;
  state: string;
}

interface FilterPanelProps {
  filters: FilterValues;
  categories: Category[];
  onChange: (filters: FilterValues) => void;
  onReset: () => void;
  loading?: boolean;
}

export const EMPTY_FILTERS: FilterValues = {
  category: "",
  city: "",
  state: "",
};

export default function FilterPanel({
  filters,
  categories,
  onChange,
  onReset,
  loading,
}: FilterPanelProps) {
  const t = useTranslations("filters");
  const hasActiveFilters = filters.category || filters.city || filters.state;

  const update = (key: keyof FilterValues, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <SlidersHorizontal size={15} />
          {t("title")}
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            <X size={12} />
            {t("clearAll")}
          </button>
        )}
      </div>

      <fieldset disabled={loading}>
        <legend className="mb-2 text-sm font-medium text-gray-700">
          {t("category")}
        </legend>
        <div className="flex flex-col gap-1.5">
          <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
            <input
              type="radio"
              name="category"
              value=""
              checked={!filters.category}
              onChange={() => update("category", "")}
              className="accent-blue-600"
            />
            {t("allCategories")}
          </label>
          {categories.map((c) => (
            <label
              key={c.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              <input
                type="radio"
                name="category"
                value={c.id}
                checked={filters.category === c.id}
                onChange={() => update("category", c.id)}
                className="accent-blue-600"
              />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset disabled={loading}>
        <legend className="mb-2 text-sm font-medium text-gray-700">
          {t("location")}
        </legend>
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={filters.city}
            onChange={(e) => update("city", e.target.value)}
            placeholder={t("cityPlaceholder")}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          <input
            type="text"
            value={filters.state}
            onChange={(e) => update("state", e.target.value)}
            placeholder={t("statePlaceholder")}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </fieldset>
    </div>
  );
}
