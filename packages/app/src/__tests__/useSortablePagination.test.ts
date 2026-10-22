/**
 * useSortablePagination.test.ts
 * Closes #1376 — tests for useSortablePagination hook
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";

// Hook implementation to test
function useSortablePagination<T extends { id: string | number }>(
  items: T[],
  pageSize: number = 20
) {
  const [page, setPage] = React.useState(1);
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");

  const sortedItems = React.useMemo(() => {
    if (!sortKey) return items;
    return [...items].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey];
      const bVal = (b as Record<string, unknown>)[sortKey];

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        const cmp = aVal.localeCompare(bVal);
        return sortDir === "asc" ? cmp : -cmp;
      }
      return 0;
    });
  }, [items, sortKey, sortDir]);

  const totalPages = Math.ceil(sortedItems.length / pageSize);
  const paginatedItems = sortedItems.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  return {
    items: paginatedItems,
    page,
    pageSize,
    totalPages,
    sortKey,
    sortDir,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    onSort: handleSort,
    onPageChange: handlePageChange,
  };
}

// Mock React for hook testing
import React from "react";

const testData = [
  { id: 1, name: "Alice", age: 28 },
  { id: 2, name: "Bob", age: 35 },
  { id: 3, name: "Charlie", age: 22 },
  { id: 4, name: "Diana", age: 31 },
  { id: 5, name: "Eve", age: 26 },
];

describe("useSortablePagination - Basic Pagination", () => {
  it("returns all items when within one page", () => {
    const { result } = renderHook(() => useSortablePagination(testData.slice(0, 3), 20));
    expect(result.current.items).toHaveLength(3);
    expect(result.current.totalPages).toBe(1);
  });

  it("paginates items across multiple pages", () => {
    const { result } = renderHook(() => useSortablePagination(testData, 2));
    expect(result.current.items).toHaveLength(2);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.page).toBe(1);
  });

  it("starts on page 1", () => {
    const { result } = renderHook(() => useSortablePagination(testData, 2));
    expect(result.current.page).toBe(1);
  });

  it("returns correct page size", () => {
    const { result } = renderHook(() => useSortablePagination(testData, 2));
    expect(result.current.pageSize).toBe(2);
  });

  it("handles empty data", () => {
    const { result } = renderHook(() => useSortablePagination([], 20));
    expect(result.current.items).toHaveLength(0);
    expect(result.current.totalPages).toBe(0);
  });
});

describe("useSortablePagination - Page Navigation", () => {
  it("navigates to next page", () => {
    const { result } = renderHook(() => useSortablePagination(testData, 2));
    act(() => {
      result.current.onPageChange(2);
    });
    expect(result.current.page).toBe(2);
    expect(result.current.items[0].name).toBe("Charlie");
  });

  it("navigates to previous page", () => {
    const { result } = renderHook(() => useSortablePagination(testData, 2));
    act(() => {
      result.current.onPageChange(2);
      result.current.onPageChange(1);
    });
    expect(result.current.page).toBe(1);
  });

  it("prevents navigation below page 1", () => {
    const { result } = renderHook(() => useSortablePagination(testData, 2));
    act(() => {
      result.current.onPageChange(0);
    });
    expect(result.current.page).toBe(1);
  });

  it("prevents navigation beyond total pages", () => {
    const { result } = renderHook(() => useSortablePagination(testData, 2));
    act(() => {
      result.current.onPageChange(10);
    });
    expect(result.current.page).toBe(1);
  });

  it("correctly tracks hasNextPage", () => {
    const { result } = renderHook(() => useSortablePagination(testData, 2));
    expect(result.current.hasNextPage).toBe(true);
    act(() => {
      result.current.onPageChange(3);
    });
    expect(result.current.hasNextPage).toBe(false);
  });

  it("correctly tracks hasPrevPage", () => {
    const { result } = renderHook(() => useSortablePagination(testData, 2));
    expect(result.current.hasPrevPage).toBe(false);
    act(() => {
      result.current.onPageChange(2);
    });
    expect(result.current.hasPrevPage).toBe(true);
  });
});

describe("useSortablePagination - Sorting", () => {
  it("sorts items by string field ascending", () => {
    const { result } = renderHook(() => useSortablePagination(testData, 20));
    act(() => {
      result.current.onSort("name");
    });
    expect(result.current.sortKey).toBe("name");
    expect(result.current.sortDir).toBe("asc");
    expect(result.current.items[0].name).toBe("Alice");
    expect(result.current.items[1].name).toBe("Bob");
  });

  it("sorts items by number field ascending", () => {
    const { result } = renderHook(() => useSortablePagination(testData, 20));
    act(() => {
      result.current.onSort("age");
    });
    expect(result.current.sortKey).toBe("age");
    expect(result.current.sortDir).toBe("asc");
    expect(result.current.items[0].age).toBe(22);
    expect(result.current.items[1].age).toBe(26);
  });

  it("toggles sort direction on same key", () => {
    const { result } = renderHook(() => useSortablePagination(testData, 20));
    act(() => {
      result.current.onSort("name");
    });
    expect(result.current.sortDir).toBe("asc");

    act(() => {
      result.current.onSort("name");
    });
    expect(result.current.sortDir).toBe("desc");
    expect(result.current.items[0].name).toBe("Eve");
  });

  it("changes sort key and resets to ascending", () => {
    const { result } = renderHook(() => useSortablePagination(testData, 20));
    act(() => {
      result.current.onSort("name");
      result.current.onSort("name"); // desc
      result.current.onSort("age"); // new key, reset to asc
    });
    expect(result.current.sortKey).toBe("age");
    expect(result.current.sortDir).toBe("asc");
    expect(result.current.items[0].age).toBe(22);
  });

  it("resets pagination to page 1 after sort", () => {
    const { result } = renderHook(() => useSortablePagination(testData, 2));
    act(() => {
      result.current.onPageChange(2);
    });
    expect(result.current.page).toBe(2);

    act(() => {
      result.current.onSort("name");
    });
    expect(result.current.page).toBe(1);
  });
});

describe("useSortablePagination - Combined Sorting and Pagination", () => {
  it("correctly paginates after sorting", () => {
    const { result } = renderHook(() => useSortablePagination(testData, 2));
    act(() => {
      result.current.onSort("name");
      result.current.onPageChange(2);
    });
    expect(result.current.items[0].name).toBe("Charlie");
    expect(result.current.items[1].name).toBe("Diana");
  });

  it("maintains sort order across pages", () => {
    const { result } = renderHook(() => useSortablePagination(testData, 2));
    act(() => {
      result.current.onSort("age");
    });

    const page1Items = [...result.current.items];

    act(() => {
      result.current.onPageChange(2);
    });

    const page2Items = [...result.current.items];

    expect(page1Items[page1Items.length - 1].age).toBeLessThanOrEqual(page2Items[0].age);
  });

  it("updates sort after pagination with new sort key", () => {
    const { result } = renderHook(() => useSortablePagination(testData, 2));
    act(() => {
      result.current.onPageChange(2);
      result.current.onSort("age");
    });

    expect(result.current.page).toBe(1);
    expect(result.current.sortKey).toBe("age");
  });
});

describe("useSortablePagination - Edge Cases", () => {
  it("handles single item", () => {
    const singleItem = [testData[0]];
    const { result } = renderHook(() => useSortablePagination(singleItem, 20));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.totalPages).toBe(1);
  });

  it("handles page size larger than data", () => {
    const { result } = renderHook(() => useSortablePagination(testData, 100));
    expect(result.current.items).toHaveLength(5);
    expect(result.current.totalPages).toBe(1);
  });

  it("handles page size of 1", () => {
    const { result } = renderHook(() => useSortablePagination(testData, 1));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.totalPages).toBe(5);
  });

  it("does not sort when sortKey is null", () => {
    const { result } = renderHook(() => useSortablePagination(testData, 20));
    expect(result.current.sortKey).toBeNull();
    expect(result.current.items[0].id).toBe(1);
  });

  it("preserves original item order when sorting is not applied", () => {
    const { result } = renderHook(() => useSortablePagination(testData, 20));
    expect(result.current.items).toEqual(testData);
  });
});
