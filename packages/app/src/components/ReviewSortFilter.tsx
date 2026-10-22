"use client";

import { useId } from "react";
import { ArrowUpDown } from "lucide-react";
import { useTranslations } from "next-intl";

export type SortOption = "newest" | "oldest" | "highest" | "lowest";

interface Props {
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
}

export default function ReviewSortFilter({ sort, onSortChange }: Props) {
  const t = useTranslations("componentText");
  const selectId = useId();
  const options = [
    { value: "newest" as const, label: t("newest") },
    { value: "oldest" as const, label: t("oldest") },
    { value: "highest" as const, label: t("highestRated") },
    { value: "lowest" as const, label: t("lowestRated") },
  ];

  return (
    <div className="flex items-center gap-2">
      <ArrowUpDown size={14} className="text-gray-400" aria-hidden="true" />
      {/* The icon gives the select no accessible name, so label it explicitly. */}
      <label htmlFor={selectId} className="sr-only">
        {t("sortReviews")}
      </label>
      <select
        id={selectId}
        value={sort}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
