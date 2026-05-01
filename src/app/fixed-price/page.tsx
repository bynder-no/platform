import Link from "next/link";
import Image from "next/image";

import {
  LISTING_CATEGORY_OPTIONS,
  parseListingCategory,
} from "@/app/create/listing-categories";
import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";
import { normalizeListingImageUrls } from "@/lib/listing-images";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

type PageProps = {
  searchParams: Promise<{
    offset?: string | string[];
    q?: string | string[];
    category?: string | string[];
    sort?: string | string[];
  }>;
};

type FixedRow = {
  id: string;
  title: string | null;
  price_nok: number | string | null;
  image_urls: unknown;
  created_at: string | null;
  category: string | null;
};

function parseOffset(raw: string | string[] | undefined): number {
  const s =
    typeof raw === "string"
      ? raw.trim()
      : Array.isArray(raw) && raw[0]
        ? String(raw[0]).trim()
        : "";
  if (!s) return 0;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0 || n % PAGE_SIZE !== 0) return 0;
  return Math.min(n, 10_000);
}

type SortFilter = "newest" | "price_asc" | "price_desc";

const SORT_FILTERS: { value: SortFilter; label: string }[] = [
  { value: "newest", label: "Nyeste" },
  { value: "price_asc", label: "Laveste pris" },
  { value: "price_desc", label: "Høyeste pris / bud" },
];

function normalizeSingle(raw: string | string[] | undefined) {
  const value =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw) && raw[0]
        ? String(raw[0])
        : "";
  return value.trim();
}

function parseSortFilter(raw: string | string[] | undefined): SortFilter {
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

function priceText(nok: number | string | null) {
  if (nok == null) return "—";
  const n = Number(nok);
  return Number.isFinite(n) ? `${n} NOK` : "—";
}

function FixedPriceListingCard({
  row,
  cardClass,
}: {
  row: FixedRow;
  cardClass: string;
}) {
  const coverImage = normalizeListingImageUrls(row.image_urls)[0] ?? null;
  return (
    <Link
      href={`/listings/${row.id}`}
      className={`${cardClass} hover:border-zinc-300`}
    >
      {coverImage ? (
        <Image
          src={coverImage}
          alt={row.title?.trim() || "Annonsebilde"}
          width={224}
          height={144}
          unoptimized
          className="mb-2 h-36 w-full rounded-md border border-zinc-200 object-cover"
        />
      ) : (
        <span className="mb-2 flex h-36 w-full items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-500">
          Ingen bilde
        </span>
      )}
      <span className="line-clamp-2 font-medium text-zinc-900">
        {row.title?.trim() || "—"}
      </span>
      <span className="tabular-nums text-zinc-600">
        {priceText(row.price_nok)}
      </span>
    </Link>
  );
}

export default async function PublicFixedPricePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const offset = parseOffset(sp.offset);
  const query = normalizeSingle(sp.q);
  const category = parseListingCategory(sp.category);
  const sortFilter = parseSortFilter(sp.sort);
  const categoryLabel =
    category != null
      ? (LISTING_CATEGORY_OPTIONS.find((o) => o.slug === category)?.label ??
        null)
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: publishDueError } = await supabase.rpc("publish_due_auctions");
  if (publishDueError) {
    console.error("publish_due_auctions:", publishDueError.message);
  }

  const selectCols =
    "id, title, description, price_nok, image_urls, created_at, category";
  const textSearchOr =
    query !== ""
      ? (() => {
          const queryPattern = `%${escapeIlikeValue(query)}%`;
          return `title.ilike.${queryPattern},description.ilike.${queryPattern}`;
        })()
      : null;

  /** Same visibility as `publicListingFeedOrFilter` fixed branch: active fixed-price only (no auction OR arms). */
  let listingsQuery = supabase
    .from("listings")
    .select(selectCols)
    .eq("type", "fixed_price")
    .neq("status", "deleted")
    .eq("status", "active");
  if (textSearchOr != null) {
    listingsQuery = listingsQuery.or(textSearchOr);
  }
  if (category != null) {
    listingsQuery = listingsQuery.eq("category", category);
  }
  if (sortFilter === "price_asc") {
    listingsQuery = listingsQuery.order("price_nok", { ascending: true });
  } else if (sortFilter === "price_desc") {
    listingsQuery = listingsQuery.order("price_nok", { ascending: false });
  } else {
    listingsQuery = listingsQuery.order("created_at", { ascending: false });
  }
  const { data: rawListings, error: listingsErr } = await listingsQuery
    .range(offset, offset + PAGE_SIZE);

  if (listingsErr) {
    throw new Error(`Could not load fixed price listings: ${listingsErr.message}`);
  }

  const rawRows = (rawListings ?? []) as FixedRow[];
  console.log("[fixed-price] query result", {
    category: category ?? "(all)",
    fetchedRowCount: rawRows.length,
  });
  const hasMore = rawRows.length > PAGE_SIZE;
  const rows = rawRows.slice(0, PAGE_SIZE);

  const cardClass =
    "flex min-w-[11rem] max-w-[14rem] flex-1 shrink-0 flex-col gap-1 rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm shadow-sm";

  const selectedSortLabel =
    SORT_FILTERS.find((item) => item.value === sortFilter)?.label ?? "Nyeste";
  const categoryCounts = new Map<string, number>();
  for (const option of LISTING_CATEGORY_OPTIONS) {
    let countQuery = supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("type", "fixed_price")
      .neq("status", "deleted")
      .eq("status", "active")
      .eq("category", option.slug);
    if (textSearchOr != null) {
      countQuery = countQuery.or(textSearchOr);
    }
    const { count } = await countQuery;
    categoryCounts.set(option.slug, count ?? 0);
  }
  let allCountQuery = supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("type", "fixed_price")
    .neq("status", "deleted")
    .eq("status", "active");
  if (textSearchOr != null) {
    allCountQuery = allCountQuery.or(textSearchOr);
  }
  const { count: allCategoryCount } = await allCountQuery;

  const buildBrowseHref = ({
    nextCategory,
    nextSort,
  }: {
    nextCategory?: string | null;
    nextSort?: SortFilter;
  }) => {
    const params = new URLSearchParams();
    if (query !== "") params.set("q", query);
    const resolvedCategory =
      nextCategory === undefined ? category : nextCategory ?? null;
    if (resolvedCategory) params.set("category", resolvedCategory);
    const resolvedSort = nextSort ?? sortFilter;
    if (resolvedSort !== "newest") params.set("sort", resolvedSort);
    const qs = params.toString();
    return qs === "" ? "/fixed-price" : `/fixed-price?${qs}`;
  };

  const nextOffset = offset + PAGE_SIZE;
  const nextHref = `${buildBrowseHref({})}${
    buildBrowseHref({}).includes("?") ? "&" : "?"
  }offset=${nextOffset}`;

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <p className="text-sm">
          <Link
            href="/"
            className="font-medium text-zinc-700 underline-offset-2 hover:underline"
          >
            ← Hjem
          </Link>
        </p>
        <div className="space-y-2">
          <h1 className={pageTitleClass}>Fastpris</h1>
          <p className="text-sm text-zinc-600">
            Finn fastprisannonser med søk, kategori og sortering.
          </p>
        </div>

        {user ? (null) : (
          <nav className="flex flex-wrap gap-x-3 gap-y-2 text-sm">
            <Link
              href="/"
              className="font-medium text-zinc-900 underline-offset-2 hover:underline"
            >
              Hjem
            </Link>
            <span className="text-zinc-300" aria-hidden>
              ·
            </span>
            <Link
              href="/login"
              className="font-medium text-zinc-900 underline-offset-2 hover:underline"
            >
              Logg inn
            </Link>
            <span className="text-zinc-300" aria-hidden>
              ·
            </span>
            <Link
              href="/signup"
              className="font-medium text-zinc-900 underline-offset-2 hover:underline"
            >
              Registrer
            </Link>
          </nav>
        )}
      </header>

      <div className={`${pageBodyGapClass} space-y-10`}>
        <section aria-labelledby="fixed-price-browse-heading">
          <h2
            id="fixed-price-browse-heading"
            className="text-base font-semibold text-zinc-900"
          >
            Bla i fastpris
          </h2>
          <form action="/fixed-price" method="get" className="mt-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="search"
                name="q"
                placeholder="Hva leter du etter?"
                defaultValue={query}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 placeholder:text-zinc-500 focus-visible:ring-2"
              />
              <input
                type="hidden"
                name="category"
                value={category ?? ""}
              />
              <input
                type="hidden"
                name="sort"
                value={sortFilter === "newest" ? "" : sortFilter}
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                Søk
              </button>
              <details className="relative">
                <summary className="inline-flex cursor-pointer list-none items-center justify-center rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200">
                  Kategorier
                </summary>
                <div className="absolute right-0 z-10 mt-2 w-72 rounded-md border border-zinc-200 bg-white p-2 shadow-lg">
                  <ul className="space-y-1">
                    <li>
                      <Link
                        href={buildBrowseHref({ nextCategory: null })}
                        className={`flex items-center justify-between rounded px-2 py-1.5 text-sm ${
                          category == null
                            ? "bg-zinc-100 font-medium text-zinc-900"
                            : "text-zinc-700 hover:bg-zinc-100"
                        }`}
                      >
                        <span>Alle kategorier</span>
                        <span className="text-xs text-zinc-500">
                          {allCategoryCount ?? 0}
                        </span>
                      </Link>
                    </li>
                    {LISTING_CATEGORY_OPTIONS.map((item) => (
                      <li key={item.slug}>
                        <Link
                          href={buildBrowseHref({ nextCategory: item.slug })}
                          className={`flex items-center justify-between rounded px-2 py-1.5 text-sm ${
                            category === item.slug
                              ? "bg-zinc-100 font-medium text-zinc-900"
                              : "text-zinc-700 hover:bg-zinc-100"
                          }`}
                        >
                          <span>{item.label}</span>
                          <span className="text-xs text-zinc-500">
                            {categoryCounts.get(item.slug) ?? 0}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            </div>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Sortering
            </span>
            {SORT_FILTERS.map((item) => {
              const active = sortFilter === item.value;
              return (
                <Link
                  key={item.value}
                  href={buildBrowseHref({ nextSort: item.value })}
                  className={
                    active
                      ? "rounded-full border border-blue-600 bg-blue-600 px-3 py-1 text-xs font-medium text-white"
                      : "rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="fixed-price-list-heading">
          <h2
            id="fixed-price-list-heading"
            className="text-base font-semibold text-zinc-900"
          >
            Annonser
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Aktivt filter:{" "}
            {categoryLabel != null ? categoryLabel : "Alle kategorier"} ·{" "}
            {selectedSortLabel}
          </p>
          {rows.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">
              Ingen fastprisannonser å vise akkurat nå.
            </p>
          ) : (
            <>
              <ul className="mt-4 flex flex-wrap gap-3">
                {rows.map((row) => (
                  <li key={row.id}>
                    <FixedPriceListingCard row={row} cardClass={cardClass} />
                  </li>
                ))}
              </ul>
              {hasMore ? (
                <p className="mt-6">
                  <Link
                    href={nextHref}
                    className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline"
                  >
                    Se mer
                  </Link>
                </p>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
