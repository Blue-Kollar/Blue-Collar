"use client";

import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

export function readLocalStorageValue<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;

    const storedValue = window.localStorage.getItem(key);
    return storedValue === null ? fallback : (JSON.parse(storedValue) as T);
  } catch {
    return fallback;
  }
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readLocalStorageValue(key, initialValue));

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch {
      // Storage is optional and may be unavailable or reject writes.
    }
  }, [key, value]);

  return [value, setValue];
}
