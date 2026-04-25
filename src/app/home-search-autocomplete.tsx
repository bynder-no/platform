"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ListingSuggestion = {
  id: string;
  title: string;
  typeLabel: "Auksjon" | "Fastpris";
  categoryLabel: string;
  priceContext: string;
};

type CategorySuggestion = {
  label: string;
  href: string;
};

const CATEGORY_SUGGESTIONS: CategorySuggestion[] = [
  { label: "Singelkort", href: "/search?category=single_card" },
  { label: "PSA/slabs", href: "/search?category=slab" },
  { label: "Sealed produkter", href: "/search?category=sealed" },
  { label: "Bulk / mange kort", href: "/search?category=bulk" },
];

export function HomeSearchAutocomplete() {
  const [query, setQuery] = useState("");
  const [listingSuggestions, setListingSuggestions] = useState<
    ListingSuggestion[]
  >([]);
  const [open, setOpen] = useState(false);
  const trimmedQuery = query.trim();

  const categorySuggestions = useMemo(() => {
    const q = trimmedQuery.toLocaleLowerCase("no");
    if (q.length < 2) return [];
    return CATEGORY_SUGGESTIONS.filter((item) =>
      item.label.toLocaleLowerCase("no").includes(q),
    );
  }, [trimmedQuery]);

  useEffect(() => {
    let cancelled = false;
    if (trimmedQuery.length < 2) {
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: trimmedQuery });
        const response = await fetch(`/api/search-suggestions?${params}`, {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) {
          if (!cancelled) setListingSuggestions([]);
          return;
        }
        const payload = (await response.json()) as {
          suggestions?: ListingSuggestion[];
        };
        if (!cancelled) {
          setListingSuggestions(
            Array.isArray(payload.suggestions) ? payload.suggestions : [],
          );
        }
      } catch {
        if (!cancelled) setListingSuggestions([]);
      }
    }, 160);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [trimmedQuery]);

  const visibleListingSuggestions =
    trimmedQuery.length >= 2 ? listingSuggestions : [];
  const directSearchHref =
    trimmedQuery.length >= 2
      ? `/search?${new URLSearchParams({ q: trimmedQuery }).toString()}`
      : "/search";

  const showDropdown = open && trimmedQuery.length >= 2;

  return (
    <div className="relative mt-4">
      <form action="/search" method="get">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setOpen(false), 120);
            }}
            placeholder="Hva leter du etter?"
            autoComplete="off"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 placeholder:text-zinc-500 focus-visible:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            Søk
          </button>
        </div>
      </form>

      {showDropdown ? (
        <div className="absolute z-20 mt-2 w-full rounded-md border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div>
            <p className="px-2 pb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Ditt søk
            </p>
            <ul className="space-y-1">
              <li>
                <Link
                  href={directSearchHref}
                  className="block rounded px-2 py-1.5 text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  {trimmedQuery}
                </Link>
              </li>
            </ul>
          </div>

          {visibleListingSuggestions.length > 0 ? (
            <div className="mt-2">
              <p className="px-2 pb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Annonser
              </p>
              <ul className="space-y-1">
                {visibleListingSuggestions.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/listings/${item.id}`}
                      className="block rounded px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <p className="line-clamp-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                        {item.typeLabel} · {item.categoryLabel}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {item.priceContext}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {categorySuggestions.length > 0 ? (
            <div
              className="mt-2"
            >
              <p className="px-2 pb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Kategorier
              </p>
              <ul className="space-y-1">
                {categorySuggestions.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block rounded px-2 py-1.5 text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
