"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Worker } from "@/types";

const MAX = 3;
const STORAGE_KEY = "bc_compare_selection";

/** Reads the saved selection; storage can be blocked, so any failure means an empty list. */
function readStoredSelection(): Worker[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Worker[]).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

interface CompareContextValue {
  selected: Worker[];
  toggle: (worker: Worker) => void;
  remove: (id: string) => void;
  clear: () => void;
  isSelected: (id: string) => boolean;
  isFull: boolean;
}

const CompareContext = createContext<CompareContextValue | null>(null);

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Worker[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Read storage after mount so the server and client first render match.
  useEffect(() => {
    setSelected(readStoredSelection());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
    } catch {
      // Storage unavailable (private mode, quota): the selection still works in memory.
    }
  }, [selected, loaded]);

  const toggle = useCallback((worker: Worker) => {
    setSelected((prev) => {
      if (prev.find((w) => w.id === worker.id)) return prev.filter((w) => w.id !== worker.id);
      if (prev.length >= MAX) return prev;
      return [...prev, worker];
    });
  }, []);

  const remove = useCallback((id: string) => setSelected((prev) => prev.filter((w) => w.id !== id)), []);
  const clear = useCallback(() => setSelected([]), []);
  const isSelected = useCallback((id: string) => selected.some((w) => w.id === id), [selected]);

  return (
    <CompareContext.Provider value={{ selected, toggle, remove, clear, isSelected, isFull: selected.length >= MAX }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare must be used inside CompareProvider");
  return ctx;
}
