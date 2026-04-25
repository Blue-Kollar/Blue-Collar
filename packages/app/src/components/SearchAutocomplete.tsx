"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Worker, ApiResponse } from "@/types";
import { cn } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";
const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

function highlight(text: string, query: string) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-100 text-yellow-800 rounded-sm px-0.5 not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

interface Props {
  defaultValue?: string;
  /** Called when user picks a suggestion or submits — passes the search term */
  onSelect?: (value: string) => void;
  /** Input name for use inside a <form> */
  name?: string;
  placeholder?: string;
  className?: string;
}

export default function SearchAutocomplete({
  defaultValue = "",
  onSelect,
  name = "search",
  placeholder = "Worker name…",
  className,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < MIN_CHARS) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    try {
      const res = await fetch(
        `${BASE}/workers?search=${encodeURIComponent(q)}&limit=6`,
        { signal: abortRef.current.signal }
      );
      if (!res.ok) return;
      const json: ApiResponse<Worker[]> = await res.json();
      setSuggestions(json.data ?? []);
      setOpen(true);
      setActiveIndex(-1);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), DEBOUNCE_MS);
  };

  const commit = (value: string) => {
    setQuery(value);
    setOpen(false);
    setSuggestions([]);
    onSelect?.(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      commit(suggestions[activeIndex].name);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          name={name}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="search-suggestions"
          aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
          className="w-full rounded-md border pl-8 pr-8 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
        {loading && (
          <Loader2
            size={14}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin"
          />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul
          id="search-suggestions"
          ref={listRef}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute z-50 mt-1 w-full rounded-lg border bg-white shadow-lg overflow-hidden animate-fade-in"
        >
          {suggestions.map((worker, i) => (
            <li
              key={worker.id}
              id={`suggestion-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent input blur before click
                commit(worker.name);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors text-sm",
                i === activeIndex
                  ? "bg-blue-50 text-blue-700"
                  : "hover:bg-gray-50 text-gray-700"
              )}
            >
              {/* Avatar / initials */}
              {worker.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={worker.avatar}
                  alt={worker.name}
                  className="h-7 w-7 rounded-full object-cover shrink-0 ring-1 ring-gray-100"
                />
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-bold">
                  {worker.name.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {highlight(worker.name, query)}
                </p>
                <p className="truncate text-xs text-gray-400">
                  {highlight(worker.category.name, query)}
                  {worker.location && (
                    <span className="text-gray-300"> · {worker.location}</span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
