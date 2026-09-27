"use client";

import { useState, useCallback } from "react";
import type { ReactNode } from "react";

interface FilterOption {
  id: string;
  label: string;
}

interface SearchFiltersProps {
  categories?: FilterOption[];
  ratings?: FilterOption[];
  locations?: FilterOption[];
  onFilterChange?: (filters: SelectedFilters) => void;
  children?: ReactNode;
}

export interface SelectedFilters {
  categories: string[];
  ratings: string[];
  locations: string[];
}

export default function SearchFilters({
  categories = [],
  ratings = [],
  locations = [],
  onFilterChange,
}: SearchFiltersProps) {
  const [selectedFilters, setSelectedFilters] = useState<SelectedFilters>({
    categories: [],
    ratings: [],
    locations: [],
  });

  const handleCategoryChange = useCallback(
    (categoryId: string) => {
      setSelectedFilters((prev) => {
        const updated = {
          ...prev,
          categories: prev.categories.includes(categoryId)
            ? prev.categories.filter((id) => id !== categoryId)
            : [...prev.categories, categoryId],
        };
        onFilterChange?.(updated);
        return updated;
      });
    },
    [onFilterChange]
  );

  const handleRatingChange = useCallback(
    (ratingId: string) => {
      setSelectedFilters((prev) => {
        const updated = {
          ...prev,
          ratings: prev.ratings.includes(ratingId)
            ? prev.ratings.filter((id) => id !== ratingId)
            : [...prev.ratings, ratingId],
        };
        onFilterChange?.(updated);
        return updated;
      });
    },
    [onFilterChange]
  );

  const handleLocationChange = useCallback(
    (locationId: string) => {
      setSelectedFilters((prev) => {
        const updated = {
          ...prev,
          locations: prev.locations.includes(locationId)
            ? prev.locations.filter((id) => id !== locationId)
            : [...prev.locations, locationId],
        };
        onFilterChange?.(updated);
        return updated;
      });
    },
    [onFilterChange]
  );

  const handleClearFilters = useCallback(() => {
    const cleared = { categories: [], ratings: [], locations: [] };
    setSelectedFilters(cleared);
    onFilterChange?.(cleared);
  }, [onFilterChange]);

  const hasActiveFilters =
    selectedFilters.categories.length > 0 ||
    selectedFilters.ratings.length > 0 ||
    selectedFilters.locations.length > 0;

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            Clear all
          </button>
        )}
      </div>

      {categories.length > 0 && (
        <FilterSection
          title="Categories"
          options={categories}
          selected={selectedFilters.categories}
          onChange={handleCategoryChange}
        />
      )}

      {ratings.length > 0 && (
        <FilterSection
          title="Ratings"
          options={ratings}
          selected={selectedFilters.ratings}
          onChange={handleRatingChange}
        />
      )}

      {locations.length > 0 && (
        <FilterSection
          title="Locations"
          options={locations}
          selected={selectedFilters.locations}
          onChange={handleLocationChange}
        />
      )}
    </div>
  );
}

interface FilterSectionProps {
  title: string;
  options: FilterOption[];
  selected: string[];
  onChange: (id: string) => void;
}

function FilterSection({ title, options, selected, onChange }: FilterSectionProps) {
  return (
    <div className="space-y-2 border-t border-gray-200 pt-4 first:border-0 first:pt-0 dark:border-gray-700">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</h4>
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.id}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
          >
            <input
              type="checkbox"
              checked={selected.includes(option.id)}
              onChange={() => onChange(option.id)}
              className="rounded border-gray-300"
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}
