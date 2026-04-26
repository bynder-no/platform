import Link from "next/link";
import Image from "next/image";

import {
  LISTING_CATEGORY_OPTIONS,
  parseListingCategory,
} from "@/app/create/listing-categories";
import { HomeCardFavoriteButton } from "@/app/home-card-favorite-button";
import { SignedInNavLinks } from "@/components/signed-in-nav-links";
import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";
import { publicListingFeedOrFilter } from "@/app/listings/public-auction-feed-filter";
import { formatAuctionTimeRemainingNo } from "@/lib/auction-time-remaining-no";
import {
  highestNokByListingId,
  type BidWithListingId,
} from "@/lib/highest-bid-nok";
import {
  leadingBidderIdByListingId,
  viewerAuctionBidPositionLabel,
  type BidForLeadingRow,
} from "@/lib/auction-viewer-bid-status";
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

type AuctionRow = {
  id: string;
  title: string | null;
  image_urls: unknown;
  auction_starts_at: string | null;
  auction_ends_at: string | null;
  created_at: string | null;
  seller_id: string | null;
};

function auctionStateLabelNo(
  nowMs: number,
  startsAt: string | null,
  endsAt: string | null,
): "Planlagt" | "Live" | "Avsluttet" {
  const startsAtMs = startsAt ? new Date(startsAt).getTime() : Number.NaN;
  const endsAtMs = endsAt ? new Date(endsAt).getTime() : Number.NaN;
  if (Number.isFinite(startsAtMs) && nowMs < startsAtMs) return "Planlagt";
  if (Number.isFinite(endsAtMs) && nowMs >= endsAtMs) return "Avsluttet";
  return "Live";
}

function auctionListingSellerLink(
  sellerId: string | null,
  usernameBySellerId: Map<string, string>,
  viewerUserId: string | null,
) {
  const u = sellerId ? usernameBySellerId.get(sellerId) : undefined;
  if (!u) {
    return (
      <span className="text-zinc-400 dark:text-zinc-500">—</span>
    );
  }
  const href =
    viewerUserId != null &&
    sellerId != null &&
    viewerUserId === sellerId
      ? "/profile"
      : `/u/${encodeURIComponent(u)}`;
  return (
    <Link
      href={href}
      className="font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
    >
      {u}
    </Link>
  );
}

function auctionListingTimeRemainingLabel(
  state: "Planlagt" | "Live" | "Avsluttet",
  startsAt: string | null,
  endsAt: string | null,
  nowMs: number,
): string | null {
  if (state === "Live") {
    const endMs = endsAt ? new Date(endsAt).getTime() : Number.NaN;
    if (!Number.isFinite(endMs)) return null;
    return formatAuctionTimeRemainingNo(endMs, nowMs);
  }
  if (state === "Planlagt") {
    const startMs = startsAt ? new Date(startsAt).getTime() : Number.NaN;
    if (!Number.isFinite(startMs)) return null;
    return formatAuctionTimeRemainingNo(startMs, nowMs);
  }
  return null;
}

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

type AuctionsListingCardProps = {
  row: AuctionRow;
  nowMs: number;
  cardClass: string;
  sellerUsernameById: Map<string, string>;
  viewerUserId: string | null;
  highestById: Map<string, number>;
  listingIdsWithAnyBid: Set<string>;
  leadingBidderByListingId: Map<string, string | null>;
  favoriteIdSet: Set<string>;
  favoriteReturnTo: string;
};

function AuctionsListingCard({
  row,
  nowMs,
  cardClass,
  sellerUsernameById,
  viewerUserId,
  highestById,
  listingIdsWithAnyBid,
  leadingBidderByListingId,
  favoriteIdSet,
  favoriteReturnTo,
}: AuctionsListingCardProps) {
  const coverImage = normalizeListingImageUrls(row.image_urls)[0] ?? null;
  const state = auctionStateLabelNo(
    nowMs,
    row.auction_starts_at ?? null,
    row.auction_ends_at ?? null,
  );
  const liveNok = highestById.get(row.id) ?? 0;
  const bidPositionLabel =
    viewerUserId != null && row.seller_id !== viewerUserId
      ? viewerAuctionBidPositionLabel(
          viewerUserId,
          listingIdsWithAnyBid.has(row.id),
          leadingBidderByListingId.get(row.id) ?? null,
        )
      : null;
  const timeLeft = auctionListingTimeRemainingLabel(
    state,
    row.auction_starts_at ?? null,
    row.auction_ends_at ?? null,
    nowMs,
  );
  return (
    <div
      className={`${cardClass} hover:border-zinc-300 dark:hover:border-zinc-600`}
    >
      {coverImage ? (
        <Image
          src={coverImage}
          alt={row.title?.trim() || "Annonsebilde"}
          width={224}
          height={144}
          unoptimized
          className="mb-2 h-36 w-full rounded-md border border-zinc-200 object-cover dark:border-zinc-700"
        />
      ) : (
        <div className="mb-2 flex h-36 w-full items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-400">
          Ingen bilde
        </div>
      )}
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link
            href={`/listings/${row.id}`}
            className="line-clamp-2 font-medium text-zinc-900 no-underline outline-none ring-zinc-400 hover:underline focus-visible:ring-2 dark:text-zinc-100"
          >
            {row.title?.trim() || "—"}
          </Link>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {auctionListingSellerLink(
              row.seller_id,
              sellerUsernameById,
              viewerUserId,
            )}
          </p>
          <Link
            href={`/listings/${row.id}`}
            className="flex flex-col gap-1 text-inherit no-underline outline-none ring-zinc-400 focus-visible:ring-2"
          >
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {state}
            </span>
            {timeLeft ? (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-medium text-zinc-600 dark:text-zinc-300">
                  Tid igjen
                </span>{" "}
                <span className="tabular-nums">{timeLeft}</span>
              </span>
            ) : null}
            <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
              {liveNok} NOK
            </span>
            {bidPositionLabel ? (
              <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
                {bidPositionLabel}
              </span>
            ) : null}
          </Link>
        </div>
        {viewerUserId &&
        row.seller_id &&
        row.seller_id !== viewerUserId ? (
          <HomeCardFavoriteButton
            listingId={row.id}
            isFavorite={favoriteIdSet.has(row.id)}
            returnTo={favoriteReturnTo}
          />
        ) : null}
      </div>
    </div>
  );
}

export default async function PublicAuctionsPage({ searchParams }: PageProps) {
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

  const now = new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();
  const textSearchOr =
    query !== ""
      ? (() => {
          const queryPattern = `%${escapeIlikeValue(query)}%`;
          return `title.ilike.${queryPattern},description.ilike.${queryPattern}`;
        })()
      : null;

  const selectCols =
    "id, title, image_urls, auction_starts_at, auction_ends_at, created_at, seller_id, price_nok";

  let listingsQuery = supabase
    .from("listings")
    .select(selectCols)
    .or(publicListingFeedOrFilter(nowIso))
    .eq("type", "auction");
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
    throw new Error(`Could not load auctions: ${listingsErr.message}`);
  }

  const rawRows = (rawListings ?? []) as AuctionRow[];
  const hasMore = rawRows.length > PAGE_SIZE;
  const rows = rawRows.slice(0, PAGE_SIZE);

  const sellerIds = [
    ...new Set(
      rows
        .map((r) => r.seller_id)
        .filter((id): id is string => typeof id === "string" && id !== ""),
    ),
  ];
  const sellerUsernameById = new Map<string, string>();
  if (sellerIds.length > 0) {
    const { data: sellerProfiles, error: sellerProfErr } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", sellerIds);

    if (sellerProfErr) {
      throw new Error(`Could not load seller profiles: ${sellerProfErr.message}`);
    }
    for (const p of sellerProfiles ?? []) {
      const u = typeof p.username === "string" ? p.username.trim() : "";
      if (p.id && u !== "") sellerUsernameById.set(p.id, u);
    }
  }

  const cardListingIds = rows
    .map((r) => r.id)
    .filter((id): id is string => typeof id === "string" && id !== "");
  const favoriteIdSet = new Set<string>();
  if (user && cardListingIds.length > 0) {
    const { data: favRows, error: favErr } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in("listing_id", cardListingIds);

    if (favErr) {
      throw new Error(`Could not load favorites: ${favErr.message}`);
    }
    for (const r of favRows ?? []) {
      const lid = r.listing_id;
      if (typeof lid === "string" && lid !== "") favoriteIdSet.add(lid);
    }
  }

  const ids = rows.map((r) => r.id).filter(Boolean);
  let highestById = new Map<string, number>();
  const listingIdsWithAnyBid = new Set<string>();
  let leadingBidderByListingId = new Map<string, string | null>();
  if (ids.length > 0) {
    const { data: bidRows, error: bidsErr } = await supabase
      .from("bids")
      .select("listing_id, amount_nok, created_at, bidder_id")
      .in("listing_id", ids);

    if (bidsErr) {
      throw new Error(`Could not load bids: ${bidsErr.message}`);
    }
    const flat = (bidRows ?? []) as BidForLeadingRow[];
    for (const r of flat) {
      const lid = r.listing_id;
      if (lid) listingIdsWithAnyBid.add(lid);
    }
    leadingBidderByListingId = leadingBidderIdByListingId(flat);
    highestById = highestNokByListingId(flat as BidWithListingId[]);
  }

  const cardClass =
    "flex min-w-[11rem] max-w-[14rem] flex-1 shrink-0 flex-col gap-1 rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900";

  const selectedSortLabel =
    SORT_FILTERS.find((item) => item.value === sortFilter)?.label ?? "Nyeste";
  const categoryCounts = new Map<string, number>();
  for (const option of LISTING_CATEGORY_OPTIONS) {
    let countQuery = supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .or(publicListingFeedOrFilter(nowIso))
      .eq("type", "auction")
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
    .or(publicListingFeedOrFilter(nowIso))
    .eq("type", "auction");
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
    return qs === "" ? "/auctions" : `/auctions?${qs}`;
  };

  const nextOffset = offset + PAGE_SIZE;
  const nextHref = `${buildBrowseHref({})}${
    buildBrowseHref({}).includes("?") ? "&" : "?"
  }offset=${nextOffset}`;
  const favoriteReturnTo =
    offset === 0
      ? buildBrowseHref({})
      : `${buildBrowseHref({})}${buildBrowseHref({}).includes("?") ? "&" : "?"}offset=${offset}`;

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
          <h1 className={pageTitleClass}>Auksjoner</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Finn auksjoner med søk, kategori og sortering.
          </p>
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
        <section aria-labelledby="auctions-browse-heading">
          <h2
            id="auctions-browse-heading"
            className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Bla i auksjoner
          </h2>
          <form action="/auctions" method="get" className="mt-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="search"
                name="q"
                placeholder="Hva leter du etter?"
                defaultValue={query}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 placeholder:text-zinc-500 focus-visible:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
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
                    <li>
                      <Link
                        href={buildBrowseHref({ nextCategory: null })}
                        className={`flex items-center justify-between rounded px-2 py-1.5 text-sm ${
                          category == null
                            ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <span>Alle kategorier</span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
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
                              ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                              : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          }`}
                        >
                          <span>{item.label}</span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
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
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
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
                      ? "rounded-full border border-zinc-400 bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900"
                      : "rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="auctions-list-heading">
          <h2
            id="auctions-list-heading"
            className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Annonser
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Aktivt filter:{" "}
            {categoryLabel != null ? categoryLabel : "Alle kategorier"} ·{" "}
            {selectedSortLabel}
          </p>
          {rows.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Ingen auksjoner å vise akkurat nå.
            </p>
          ) : (
            <>
              <ul className="mt-4 flex flex-wrap gap-3">
                {rows.map((row) => (
                  <li key={row.id}>
                    <AuctionsListingCard
                      row={row}
                      nowMs={nowMs}
                      cardClass={cardClass}
                      sellerUsernameById={sellerUsernameById}
                      viewerUserId={user?.id ?? null}
                      highestById={highestById}
                      listingIdsWithAnyBid={listingIdsWithAnyBid}
                      leadingBidderByListingId={leadingBidderByListingId}
                      favoriteIdSet={favoriteIdSet}
                      favoriteReturnTo={favoriteReturnTo}
                    />
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
