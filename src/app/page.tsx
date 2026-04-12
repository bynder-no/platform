import Link from "next/link";

import { SignedInNavLinks } from "@/components/signed-in-nav-links";
import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";

export const dynamic = "force-dynamic";

const inputClass =
  "min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";

const buttonClass =
  "rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

type PageProps = {
  searchParams: Promise<{
    q?: string | string[];
    type?: string | string[];
    sort?: string | string[];
  }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const rawQ = sp.q;
  const q =
    typeof rawQ === "string"
      ? rawQ.trim()
      : Array.isArray(rawQ) && rawQ[0]
        ? String(rawQ[0]).trim()
        : "";

  const rawType = sp.type;
  const typeParam =
    typeof rawType === "string"
      ? rawType.trim()
      : Array.isArray(rawType) && rawType[0]
        ? String(rawType[0]).trim()
        : "";

  const listingType =
    typeParam === "auction" || typeParam === "fixed_price"
      ? typeParam
      : null;

  const rawSort = sp.sort;
  const sortParam =
    typeof rawSort === "string"
      ? rawSort.trim()
      : Array.isArray(rawSort) && rawSort[0]
        ? String(rawSort[0]).trim()
        : "";

  const listingSort =
    sortParam === "newest" ||
    sortParam === "oldest" ||
    sortParam === "price_asc" ||
    sortParam === "price_desc"
      ? sortParam
      : "newest";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("listings")
    .select("id, title, type, price_nok, status, created_at")
    .eq("status", "active");

  if (listingType) {
    query = query.eq("type", listingType);
  }

  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  if (listingSort === "oldest") {
    query = query.order("created_at", { ascending: true });
  } else if (listingSort === "price_asc") {
    query = query.order("price_nok", { ascending: true });
  } else if (listingSort === "price_desc") {
    query = query.order("price_nok", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data: listings, error } = await query;

  if (error) {
    throw new Error(`Could not load listings: ${error.message}`);
  }

  const rows = listings ?? [];

  const listingsHref = (overrides: {
    q?: string | null;
    type?: string | null;
    sort?: string | null;
  }) => {
    const p = new URLSearchParams();
    const qv = overrides.q !== undefined ? overrides.q : q;
    const tv = overrides.type !== undefined ? overrides.type : listingType;
    const sv =
      (overrides.sort !== undefined ? overrides.sort : listingSort) ??
      "newest";
    if (qv) p.set("q", qv);
    if (tv) p.set("type", tv);
    p.set("sort", sv);
    return `/?${p.toString()}`;
  };

  const clearSearchHref = listingsHref({ q: null });

  const allTypeHref = listingsHref({ type: null });
  const fixedPriceTypeHref = listingsHref({ type: "fixed_price" });
  const auctionTypeHref = listingsHref({ type: "auction" });

  const newestSortHref = listingsHref({ sort: "newest" });
  const oldestSortHref = listingsHref({ sort: "oldest" });
  const priceAscSortHref = listingsHref({ sort: "price_asc" });
  const priceDescSortHref = listingsHref({ sort: "price_desc" });

  const filterLinkClass = (active: boolean) =>
    active
      ? "font-semibold text-zinc-900 underline decoration-2 underline-offset-2 dark:text-zinc-50"
      : "font-medium text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100";

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <div className="space-y-2">
          <h1 className={pageTitleClass}>Listings</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Public feed of all listings.
          </p>
        </div>

        <form
          method="get"
          action="/"
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
        >
        <label className="sr-only" htmlFor="listing-search-q">
          Search listings by title
        </label>
        <input
          id="listing-search-q"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by title"
          className={inputClass}
        />
        {listingType ? (
          <input type="hidden" name="type" value={listingType} />
        ) : null}
        <input type="hidden" name="sort" value={listingSort} />
        <button type="submit" className={buttonClass}>
          Search
        </button>
        </form>

        <div className="space-y-2">
        <nav aria-label="Listing type">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <Link
              href={allTypeHref}
              className={filterLinkClass(!listingType)}
              aria-current={!listingType ? "page" : undefined}
            >
              All
            </Link>
            <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
              ·
            </span>
            <Link
              href={fixedPriceTypeHref}
              className={filterLinkClass(listingType === "fixed_price")}
              aria-current={listingType === "fixed_price" ? "page" : undefined}
            >
              Fixed price
            </Link>
            <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
              ·
            </span>
            <Link
              href={auctionTypeHref}
              className={filterLinkClass(listingType === "auction")}
              aria-current={listingType === "auction" ? "page" : undefined}
            >
              Auction
            </Link>
          </p>
        </nav>

        <nav aria-label="Sort listings">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <Link
              href={newestSortHref}
              className={filterLinkClass(listingSort === "newest")}
              aria-current={listingSort === "newest" ? "page" : undefined}
            >
              Newest
            </Link>
            <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
              ·
            </span>
            <Link
              href={oldestSortHref}
              className={filterLinkClass(listingSort === "oldest")}
              aria-current={listingSort === "oldest" ? "page" : undefined}
            >
              Oldest
            </Link>
            <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
              ·
            </span>
            <Link
              href={priceAscSortHref}
              className={filterLinkClass(listingSort === "price_asc")}
              aria-current={listingSort === "price_asc" ? "page" : undefined}
              aria-label="Sort by price, lowest first"
            >
              Price ↑
            </Link>
            <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
              ·
            </span>
            <Link
              href={priceDescSortHref}
              className={filterLinkClass(listingSort === "price_desc")}
              aria-current={listingSort === "price_desc" ? "page" : undefined}
              aria-label="Sort by price, highest first"
            >
              Price ↓
            </Link>
          </p>
        </nav>
        </div>

        {q ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {`Showing results for "${q}"`}{" "}
            <Link
              href={clearSearchHref}
              className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
            >
              Clear
            </Link>
          </p>
        ) : null}

        {user ? (
          <SignedInNavLinks />
        ) : (
          <nav className="flex flex-wrap gap-x-3 gap-y-2 text-sm">
          <Link
            href="/"
            className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
          >
            Home
          </Link>
          <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
            ·
          </span>
          <Link
            href="/login"
            className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
          >
            Login
          </Link>
          <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
            ·
          </span>
          <Link
            href="/signup"
            className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
          >
            Signup
          </Link>
          <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
            ·
          </span>
          <Link
            href="/dashboard"
            className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
          >
            Dashboard
          </Link>
          </nav>
        )}
      </header>

      <section className={pageBodyGapClass}>
        {rows.length === 0 ? (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            <p className="font-medium text-zinc-800 dark:text-zinc-200">
              {q || listingType ? "No matching listings" : "No listings yet"}
            </p>
            <p className="mt-2">
              {q || listingType
                ? "Try a different search or listing type."
                : "The feed is empty. Check back later."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
            {rows.map((row) => {
              const rawType =
                typeof row.type === "string" ? row.type.trim() : "";
              const typeLabel =
                rawType === "auction"
                  ? "Auction"
                  : rawType === "fixed_price"
                    ? "Fixed price"
                    : "—";

              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-1 px-3 py-3 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                >
                  <Link
                    href={`/listings/${row.id}`}
                    className="font-medium text-zinc-900 dark:text-zinc-100"
                  >
                    {row.title}
                  </Link>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {typeLabel}
                    <span className="mx-2 text-zinc-400">·</span>
                    {row.price_nok != null ? `${row.price_nok} NOK` : "—"}
                    <span className="mx-2 text-zinc-400">·</span>
                    {row.status}
                    <span className="mx-2 text-zinc-400">·</span>
                    {row.created_at
                      ? new Date(row.created_at).toLocaleString()
                      : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
