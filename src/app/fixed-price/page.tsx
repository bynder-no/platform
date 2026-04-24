import Link from "next/link";

import {
  LISTING_CATEGORY_OPTIONS,
  parseListingCategory,
} from "@/app/create/listing-categories";
import { SignedInNavLinks } from "@/components/signed-in-nav-links";
import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

type PageProps = {
  searchParams: Promise<{
    offset?: string | string[];
    category?: string | string[];
  }>;
};

type FixedRow = {
  id: string;
  title: string | null;
  price_nok: number | string | null;
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

const categoryHubCardClass =
  "flex min-h-[5rem] flex-col justify-center rounded-xl border border-zinc-200 bg-white px-5 py-4 text-left text-base font-semibold text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:border-zinc-500 dark:hover:bg-zinc-900 dark:focus-visible:outline-zinc-100";

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
  return (
    <Link
      href={`/listings/${row.id}`}
      className={`${cardClass} hover:border-zinc-300 dark:hover:border-zinc-600`}
    >
      <span className="line-clamp-2 font-medium text-zinc-900 dark:text-zinc-100">
        {row.title?.trim() || "—"}
      </span>
      <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
        {priceText(row.price_nok)}
      </span>
    </Link>
  );
}

export default async function PublicFixedPricePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const offset = parseOffset(sp.offset);
  const category = parseListingCategory(sp.category);
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

  const selectCols = "id, title, price_nok, created_at, category";

  /** Same visibility as `publicListingFeedOrFilter` fixed branch: active fixed-price only (no auction OR arms). */
  let listingsQuery = supabase
    .from("listings")
    .select(selectCols)
    .eq("type", "fixed_price")
    .eq("status", "active");
  if (category != null) {
    listingsQuery = listingsQuery.eq("category", category);
  }
  const { data: rawListings, error: listingsErr } = await listingsQuery
    .order("created_at", { ascending: false })
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
    "flex min-w-[11rem] max-w-[14rem] flex-1 shrink-0 flex-col gap-1 rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900";

  const nextOffset = offset + PAGE_SIZE;
  const nextHref =
    category != null
      ? `/fixed-price?category=${encodeURIComponent(category)}&offset=${nextOffset}`
      : `/fixed-price?offset=${nextOffset}`;

  const pageTitle =
    category != null && categoryLabel != null ? categoryLabel : "Fastpris";
  const pageSubtitle =
    category != null && categoryLabel != null
      ? `Fastprisannonser i kategorien «${categoryLabel}».`
      : "Velg kategori eller bla i alle fastprisannonser.";

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <p className="text-sm">
          <Link
            href="/"
            className="font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
          >
            ← Hjem
          </Link>
        </p>
        <div className="space-y-2">
          <h1 className={pageTitleClass}>{pageTitle}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {pageSubtitle}
          </p>
          {category != null ? (
            <p className="text-sm">
              <Link
                href="/fixed-price"
                className="font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
              >
                ← Alle kategorier
              </Link>
            </p>
          ) : null}
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

      <div className={`${pageBodyGapClass} space-y-10`}>
        {category == null ? (
          <section aria-labelledby="fixed-price-category-hub-heading">
            <h2
              id="fixed-price-category-hub-heading"
              className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Kategorier
            </h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {LISTING_CATEGORY_OPTIONS.map(({ slug, label }) => (
                <li key={slug}>
                  <Link
                    href={`/fixed-price?category=${slug}`}
                    className={categoryHubCardClass}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="fixed-price-list-heading">
          <h2
            id="fixed-price-list-heading"
            className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
          >
            {category == null ? "Alle fastprisannonser" : "Annonser"}
          </h2>
          {rows.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
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
                    className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
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
