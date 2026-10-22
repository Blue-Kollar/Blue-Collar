/**
 * useTransactionFilters
 *
 * Encapsulates the client-side filtering logic for a flat list of raw
 * Horizon payment records. Keeps filter state isolated from fetching and
 * pagination concerns.
 */
import { useMemo, useState } from "react";

export interface TransactionFilterOptions {
  /** When set, only payments originating from this address are kept. */
  fromAddress?: string;
  /** When set, only payments with this asset type are kept (e.g. "native"). */
  assetType?: string;
}

export interface UseTransactionFiltersResult<T> {
  filtered: T[];
  filterOptions: TransactionFilterOptions;
  setFilterOptions: (opts: TransactionFilterOptions) => void;
  clearFilters: () => void;
}

/**
 * Applies optional address and asset-type filters to a list of items.
 *
 * @param items   - The source list of transaction-like objects.
 * @param getFrom - Accessor that returns the "from" field of an item.
 * @param getAssetType - Accessor that returns the asset type of an item.
 */
export function useTransactionFilters<T>(
  items: T[],
  getFrom: (item: T) => string,
  getAssetType: (item: T) => string,
): UseTransactionFiltersResult<T> {
  const [filterOptions, setFilterOptions] = useState<TransactionFilterOptions>({});

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (filterOptions.fromAddress && getFrom(item) !== filterOptions.fromAddress) {
        return false;
      }
      if (filterOptions.assetType && getAssetType(item) !== filterOptions.assetType) {
        return false;
      }
      return true;
    });
  }, [items, filterOptions, getFrom, getAssetType]);

  const clearFilters = () => setFilterOptions({});

  return { filtered, filterOptions, setFilterOptions, clearFilters };
}
