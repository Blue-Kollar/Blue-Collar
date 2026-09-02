"use client";

import { createContext, useCallback,useContext, useState } from "react";

import type { Worker } from "@/types";

const MAX = 4;

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
