"use client";

import { useCallback, useMemo } from "react";

export interface FilterValues {
  category: string;
  city: string;
  state: string;
}

export const EMPTY_FILTERS: FilterValues = {
  category: "",
  city: "",
  state: "",
};

export function countActiveFilters(filters: FilterValues): number {
  return Object.values(filters).filter(Boolean).length;
}

/**
 * Shared view of the discovery filters. The parent owns the values, so the
 * desktop panel, the mobile sheet and the chips all read and write through
 * the same `onChange`/`onReset` pair.
 */
export function useFilterState(
  filters: FilterValues,
  onChange: (filters: FilterValues) => void,
  onReset: () => void,
) {
  const update = useCallback(
    (key: keyof FilterValues, value: string) => {
      onChange({ ...filters, [key]: value });
    },
    [filters, onChange],
  );

  const activeCount = useMemo(() => countActiveFilters(filters), [filters]);

  return {
    update,
    reset: onReset,
    activeCount,
    hasActiveFilters: activeCount > 0,
  };
}
