/**
 * useDashboardWorkers.test.ts
 * Closes #1568 — unit tests for the useDashboardWorkers hook
 */

import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDashboardWorkers } from "@/hooks/useDashboardWorkers";
import type { DashboardWorker } from "@/components/Dashboard/WorkersPanel";

const makeWorker = (id: string, isActive: boolean): DashboardWorker => ({
  id,
  name: `Worker ${id}`,
  isActive,
  createdAt: "2026-01-01T00:00:00.000Z",
  category: { id: "cat-1", name: "Plumbing" },
});

describe("useDashboardWorkers", () => {
  it("returns zero counts for an empty list", () => {
    const { result } = renderHook(() => useDashboardWorkers([]));

    expect(result.current).toEqual({ total: 0, active: 0, inactive: 0 });
  });

  it("counts active and inactive workers separately", () => {
    const workers = [makeWorker("a", true), makeWorker("b", false), makeWorker("c", true)];
    const { result } = renderHook(() => useDashboardWorkers(workers));

    expect(result.current).toEqual({ total: 3, active: 2, inactive: 1 });
  });

  it("recomputes counts when the workers array changes", () => {
    const { result, rerender } = renderHook(
      ({ workers }: { workers: DashboardWorker[] }) => useDashboardWorkers(workers),
      { initialProps: { workers: [makeWorker("a", true)] } }
    );

    rerender({ workers: [makeWorker("a", false), makeWorker("b", false)] });

    expect(result.current).toEqual({ total: 2, active: 0, inactive: 2 });
  });
});
