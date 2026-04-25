import Link from "next/link";

import { SignedInNavLinks } from "@/components/signed-in-nav-links";
import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";
import { publicListingFeedOrFilter } from "@/app/listings/public-auction-feed-filter";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    type?: string | string[];
    category?: string | string[];
    sort?: string | string[];
  }>;
};

type SearchListingRow = {
  id: string;
  title: string | null;
  description: string | null;
  type: string | null;
  category: string | null;
  price_nok: number | string | null;
  created_at: string | null;
  seller_id: string | null;
};

type ListingCategoryFilter = "all" | "single_card" | "slab" | "sealed" | "bulk";
type ListingSortFilter = "newest" | "price_asc" | "price_desc";
type ListingTypeValue = "auction" | "fixed_price";

const TYPE_FILTERS: { value: ListingTypeValue; label: string }[] = [
  { value: "auction", label: "Auksjon" },
  { value: "fixed_price", label: "Fastpris" },
];

const CATEGORY_FILTERS: { value: ListingCategoryFilter; label: string }[] = [
  { value: "all", label: "Alle kategorier" },
  { value: "single_card", label: "Singelkort" },
  { value: "slab", label: "PSA/slabs" },
  { value: "sealed", label: "Sealed produkter" },
  { value: "bulk", label: "Bulk / mange kort" },
];

const SORT_FILTERS: { value: ListingSortFilter; label: string }[] = [
  { value: "newest", label: "Nyeste" },
  { value: "price_asc", label: "Laveste pris" },
  { value: "price_desc", label: "Høyeste pris / bud" },
];

function sellerUsernameLink(
  sellerId: string | null,
  usernameBySellerId: Map<string, string>,
  viewerUserId: string | null,
) {
  const username = sellerId ? usernameBySellerId.get(sellerId) : undefined;
  if (!username) {
    return <span className="text-zinc-400 dark:text-zinc-500">—</span>;
  }
  const href =
    viewerUserId != null &&
    sellerId != null &&
    viewerUserId === sellerId
      ? "/profile"
      : `/u/${encodeURIComponent(username)}`;
  return (
    <Link
      href={href}
      className="font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
    >
      {username}
    </Link>
  );
}

function priceText(nok: number | string | null) {
  if (nok == null) return "—";
  const n = Number(nok);
  return Number.isFinite(n) ? `${n} NOK` : "—";
}

function normalizeQuery(raw: string | string[] | undefined) {
  const value =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw) && raw[0]
        ? String(raw[0])
        : "";
  return value.trim();
}

function normalizeSingle(raw: string | string[] | undefined) {
  const value =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw) && raw[0]
        ? String(raw[0])
        : "";
  return value.trim();
}

function parseTypeFilters(raw: string | string[] | undefined): ListingTypeValue[] {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out: ListingTypeValue[] = [];
  for (const value of values) {
    for (const token of String(value).split(",")) {
      const v = token.trim();
      if ((v === "auction" || v === "fixed_price") && !out.includes(v)) {
        out.push(v);
      }
    }
  }
  return out;
}

function parseCategoryFilter(
  raw: string | string[] | undefined,
): ListingCategoryFilter {
  const value = normalizeSingle(raw);
  if (
    value === "single_card" ||
    value === "slab" ||
    value === "sealed" ||
    value === "bulk"
  ) {
    return value;
  }
  return "all";
}

function parseSortFilter(raw: string | string[] | undefined): ListingSortFilter {
  const value = normalizeSingle(raw);
  if (value === "price_asc" || value === "price_desc") return value;
  return "newest";
}

function escapeIlikeValue(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams;
  const query = normalizeQuery(sp.q);
  const typeFilters = parseTypeFilters(sp.type);
  const categoryFilter = parseCategoryFilter(sp.category);
  const sortFilter = parseSortFilter(sp.sort);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const selectedTypeLabel =
    typeFilters.length === 0
      ? "Auksjon + Fastpris"
      : typeFilters
          .map((type) => TYPE_FILTERS.find((item) => item.value === type)?.label)
          .filter((label): label is string => typeof label === "string")
          .join(" + ");
  const selectedCategoryLabel =
    CATEGORY_FILTERS.find((item) => item.value === categoryFilter)?.label ??
    "Alle kategorier";
  const selectedSortLabel =
    SORT_FILTERS.find((item) => item.value === sortFilter)?.label ?? "Nyeste";

  const buildSearchHref = ({
    types,
    category,
    sort,
  }: {
    types?: ListingTypeValue[];
    category?: ListingCategoryFilter;
    sort?: ListingSortFilter;
  }) => {
    const params = new URLSearchParams();
    if (query !== "") params.set("q", query);
    const resolvedTypes = types ?? typeFilters;
    const resolvedCategory = category ?? categoryFilter;
    const resolvedSort = sort ?? sortFilter;
    for (const type of resolvedTypes) {
      params.append("type", type);
    }
    if (resolvedCategory !== "all") params.set("category", resolvedCategory);
    if (resolvedSort !== "newest") params.set("sort", resolvedSort);
    const qs = params.toString();
    return qs === "" ? "/search" : `/search?${qs}`;
  };

  const toggledTypesHref = (typeValue: ListingTypeValue) => {
    const current = new Set(typeFilters);
    if (current.has(typeValue)) {
      current.delete(typeValue);
    } else {
      current.add(typeValue);
    }
    return buildSearchHref({ types: [...current] });
  };

  let rows: SearchListingRow[] = [];
  const categoryCounts = new Map<ListingCategoryFilter, number>();
  if (query !== "") {
    const nowIso = new Date().toISOString();
    const queryPattern = `%${escapeIlikeValue(query)}%`;
    const textSearchOr = `title.ilike.${queryPattern},description.ilike.${queryPattern}`;

    let listingsQuery = supabase
      .from("listings")
      .select(
        "id, title, description, type, category, price_nok, created_at, seller_id",
      )
      .or(publicListingFeedOrFilter(nowIso))
      .in("type", ["auction", "fixed_price"])
      .or(textSearchOr);
    if (typeFilters.length === 1) {
      listingsQuery = listingsQuery.eq("type", typeFilters[0]);
    } else if (typeFilters.length > 1) {
      listingsQuery = listingsQuery.in("type", typeFilters);
    }
    if (categoryFilter !== "all") {
      listingsQuery = listingsQuery.eq("category", categoryFilter);
    }
    if (sortFilter === "price_asc") {
      listingsQuery = listingsQuery.order("price_nok", { ascending: true });
    } else if (sortFilter === "price_desc") {
      listingsQuery = listingsQuery.order("price_nok", { ascending: false });
    } else {
      listingsQuery = listingsQuery.order("created_at", { ascending: false });
    }
    const { data, error } = await listingsQuery.limit(50);

    if (error) {
      throw new Error(`Could not load search results: ${error.message}`);
    }
    rows = (data ?? []) as SearchListingRow[];

    for (const category of CATEGORY_FILTERS) {
      let countQuery = supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .or(publicListingFeedOrFilter(nowIso))
        .in("type", ["auction", "fixed_price"])
        .or(textSearchOr);
      if (typeFilters.length === 1) {
        countQuery = countQuery.eq("type", typeFilters[0]);
      } else if (typeFilters.length > 1) {
        countQuery = countQuery.in("type", typeFilters);
      }
      if (category.value !== "all") {
        countQuery = countQuery.eq("category", category.value);
      }
      const { count } = await countQuery;
      categoryCounts.set(category.value, count ?? 0);
    }
  }

  const sellerIds = [
    ...new Set(
      rows
        .map((row) => row.seller_id)
        .filter((id): id is string => typeof id === "string" && id !== ""),
    ),
  ];
  const sellerUsernameById = new Map<string, string>();
  if (sellerIds.length > 0) {
    const { data: sellerProfiles, error: sellerProfilesError } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", sellerIds);
    if (sellerProfilesError) {
      throw new Error(
        `Could not load seller profiles: ${sellerProfilesError.message}`,
      );
    }
    for (const profile of sellerProfiles ?? []) {
      const username =
        typeof profile.username === "string" ? profile.username.trim() : "";
      if (profile.id && username !== "") {
        sellerUsernameById.set(profile.id, username);
      }
    }
  }

  const cardClass =
    "rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900";

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <div className="space-y-2">
          <p className="text-sm">
            <Link
              href="/"
              className="font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
            >
              ← Hjem
            </Link>
          </p>
          <h1 className={pageTitleClass}>Søk</h1>
        </div>
        {user ? (
          <SignedInNavLinks />
        ) : (
          <nav className="flex flex-wrap gap-x-3 gap-y-2 text-sm">
            <Link
              href="/"
              className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
            >
              Hjem
            </Link>
            <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
              ·
            </span>
            <Link
              href="/login"
              className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
            >
              Logg inn
            </Link>
            <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
              ·
            </span>
            <Link
              href="/signup"
              className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
            >
              Registrer
            </Link>
          </nav>
        )}
      </header>

      <div className={`${pageBodyGapClass} space-y-8`}>
        <section aria-labelledby="search-form-heading">
          <h2
            id="search-form-heading"
            className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Finn annonser
          </h2>
          <form action="/search" method="get" className="mt-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="search"
                name="q"
                placeholder="Hva leter du etter?"
                defaultValue={query}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 placeholder:text-zinc-500 focus-visible:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
              />
              {typeFilters.map((typeValue) => (
                <input key={typeValue} type="hidden" name="type" value={typeValue} />
              ))}
              <input
                type="hidden"
                name="category"
                value={categoryFilter === "all" ? "" : categoryFilter}
              />
              <input
                type="hidden"
                name="sort"
                value={sortFilter === "newest" ? "" : sortFilter}
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                Søk
              </button>
              <details className="relative">
                <summary className="inline-flex cursor-pointer list-none items-center justify-center rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700">
                  Kategorier
                </summary>
                <div className="absolute right-0 z-10 mt-2 w-72 rounded-md border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  <ul className="space-y-1">
                    {CATEGORY_FILTERS.map((item) => {
                      const active = categoryFilter === item.value;
                      const countLabel = categoryCounts.get(item.value);
                      return (
                        <li key={item.value}>
                          <Link
                            href={buildSearchHref({ category: item.value })}
                            className={
                              active
                                ? "flex items-center justify-between rounded px-2 py-1.5 text-sm font-medium text-zinc-900 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-100"
                                : "flex items-center justify-between rounded px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            }
                          >
                            <span>{item.label}</span>
                            {query !== "" ? (
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                {countLabel ?? 0}
                              </span>
                            ) : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </details>
            </div>
          </form>
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Type
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {TYPE_FILTERS.map((item) => {
                  const active = typeFilters.includes(item.value);
                  return (
                    <Link
                      key={item.value}
                      href={toggledTypesHref(item.value)}
                      className={
                        active
                          ? "inline-flex items-center gap-2 rounded-full border border-zinc-400 bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900"
                          : "inline-flex items-center gap-2 rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      }
                    >
                      <span
                        className={
                          active
                            ? "h-3 w-3 rounded-sm border border-current bg-current"
                            : "h-3 w-3 rounded-sm border border-current"
                        }
                        aria-hidden
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Kategori
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {CATEGORY_FILTERS.map((item) => {
                  const active = categoryFilter === item.value;
                  return (
                    <Link
                      key={item.value}
                      href={buildSearchHref({ category: item.value })}
                      className={
                        active
                          ? "rounded-full border border-zinc-400 bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900"
                          : "rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      }
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Sortering
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SORT_FILTERS.map((item) => {
                  const active = sortFilter === item.value;
                  return (
                    <Link
                      key={item.value}
                      href={buildSearchHref({ sort: item.value })}
                      className={
                        active
                          ? "rounded-full border border-zinc-400 bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900"
                          : "rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      }
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="search-results-heading">
          <h2
            id="search-results-heading"
            className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Resultater
          </h2>
          {query === "" ? (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Søk etter Pokémon-kort, sealed produkter, slabs eller bulk.
            </p>
          ) : (
            <>
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                {rows.length} treff for{" "}
                <span className="font-medium">“{query}”</span>.
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Aktivt filter: {selectedTypeLabel} · {selectedCategoryLabel} ·{" "}
                {selectedSortLabel}
              </p>
              {rows.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                  Ingen annonser matcher søket akkurat nå.
                </p>
              ) : (
                <ul className="mt-4 grid gap-3">
                  {rows.map((row) => (
                    <li key={row.id} className={cardClass}>
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/listings/${row.id}`}
                          className="line-clamp-2 font-medium text-zinc-900 no-underline outline-none ring-zinc-400 hover:underline focus-visible:ring-2 dark:text-zinc-100"
                        >
                          {row.title?.trim() || "—"}
                        </Link>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {sellerUsernameLink(
                            row.seller_id,
                            sellerUsernameById,
                            user?.id ?? null,
                          )}
                        </p>
                        {row.description?.trim() ? (
                          <p className="line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">
                            {row.description.trim()}
                          </p>
                        ) : null}
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                          {row.type === "fixed_price"
                            ? `Fastpris - ${priceText(row.price_nok)}`
                            : "Auksjon"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
