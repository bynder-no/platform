import Link from "next/link";
import Image from "next/image";

import { HomeCardFavoriteButton } from "@/app/home-card-favorite-button";
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
import { ListingCategoryBadge } from "@/components/listing-category-badge";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;

type SearchPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    type?: string | string[];
    category?: string | string[];
    sort?: string | string[];
    page?: string | string[];
  }>;
};

type SearchListingRow = {
  id: string;
  title: string | null;
  description: string | null;
  image_urls: unknown;
  type: string | null;
  category: string | null;
  price_nok: number | string | null;
  created_at: string | null;
  seller_id: string | null;
  auction_starts_at: string | null;
  auction_ends_at: string | null;
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

const listingCardClass =
  "group relative flex w-full min-w-0 max-w-none flex-col gap-2.5 rounded-2xl border border-zinc-200 bg-white p-3 text-sm shadow-sm transition-all duration-300 ease-out cursor-pointer hover:-translate-y-1 hover:border-zinc-300 hover:shadow-md";

function searchSellerDisplay(
  sellerId: string | null,
  usernameBySellerId: Map<string, string>,
) {
  const u = sellerId ? usernameBySellerId.get(sellerId) : undefined;
  if (!u) {
    return <span className="text-zinc-400">—</span>;
  }
  return (
    <span className="font-medium text-zinc-700 underline-offset-2 group-hover:underline">
      {u}
    </span>
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

function parsePage(raw: string | string[] | undefined): number {
  const value = normalizeSingle(raw);
  if (value === "") return 1;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

/** Page numbers with ellipsis gaps for long ranges. */
function paginationItems(
  current: number,
  total: number,
): (number | "ellipsis")[] {
  if (total <= 1) return total === 1 ? [1] : [];
  if (total <= 9) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const set = new Set<number>();
  set.add(1);
  set.add(total);
  for (let p = current - 2; p <= current + 2; p++) {
    if (p >= 1 && p <= total) set.add(p);
  }
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev > 0 && p - prev > 1) out.push("ellipsis");
    out.push(p);
    prev = p;
  }
  return out;
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

function homeAuctionTimeRemainingLabel(
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

type SearchListingCardProps = {
  row: SearchListingRow;
  nowMs: number;
  sellerUsernameById: Map<string, string>;
  viewerUserId: string | null;
  auctionHighestNokById: Map<string, number>;
  listingIdsWithAnyAuctionBid: Set<string>;
  auctionLeadingBidderByListingId: Map<string, string | null>;
  favoriteIdSet: Set<string>;
  favoriteReturnTo: string;
};

function SearchListingCard({
  row,
  nowMs,
  sellerUsernameById,
  viewerUserId,
  auctionHighestNokById,
  listingIdsWithAnyAuctionBid,
  auctionLeadingBidderByListingId,
  favoriteIdSet,
  favoriteReturnTo,
}: SearchListingCardProps) {
  const coverImage = normalizeListingImageUrls(row.image_urls)[0] ?? null;
  const listingLabel = row.title?.trim()
    ? `Se annonse: ${row.title.trim()}`
    : "Se annonse";

  if (row.type === "auction") {
    const state = auctionStateLabelNo(
      nowMs,
      row.auction_starts_at ?? null,
      row.auction_ends_at ?? null,
    );
    const liveNok = auctionHighestNokById.get(row.id) ?? 0;
    const bidPositionLabel =
      viewerUserId != null && row.seller_id !== viewerUserId
        ? viewerAuctionBidPositionLabel(
            viewerUserId,
            listingIdsWithAnyAuctionBid.has(row.id),
            auctionLeadingBidderByListingId.get(row.id) ?? null,
          )
        : null;
    const timeLeft = homeAuctionTimeRemainingLabel(
      state,
      row.auction_starts_at ?? null,
      row.auction_ends_at ?? null,
      nowMs,
    );

    return (
      <div className={listingCardClass}>
        <Link
          href={`/listings/${row.id}`}
          className="absolute inset-0 z-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
          aria-label={listingLabel}
        />
        <div className="relative z-10 flex flex-col gap-2.5 pointer-events-none">
          {coverImage ? (
            <div className="mb-1.5 overflow-hidden rounded-xl border border-zinc-200">
              <Image
                src={coverImage}
                alt=""
                width={224}
                height={144}
                unoptimized
                className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
          ) : (
            <div className="mb-1.5 flex h-44 w-full items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-500">
              Ingen bilde
            </div>
          )}
          <div className="flex items-start gap-2.5">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <p className="line-clamp-2 font-semibold text-zinc-900 group-hover:underline">
                {row.title?.trim() || "—"}
              </p>
              <p className="text-xs text-zinc-500">
                {searchSellerDisplay(row.seller_id, sellerUsernameById)}
              </p>
              <ListingCategoryBadge category={row.category} />
              <div className="flex flex-col gap-1 text-inherit">
                <span className="inline-flex w-fit rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  {state}
                </span>
                {timeLeft ? (
                  <span className="text-xs text-zinc-500">
                    <span className="font-medium text-zinc-600">Tid igjen</span>{" "}
                    <span className="tabular-nums">{timeLeft}</span>
                  </span>
                ) : null}
                <span className="tabular-nums text-lg font-semibold text-zinc-900">
                  {liveNok} NOK
                </span>
                {bidPositionLabel ? (
                  <span className="text-xs font-medium text-amber-800">
                    {bidPositionLabel}
                  </span>
                ) : null}
              </div>
            </div>
            {viewerUserId &&
            row.seller_id &&
            row.seller_id !== viewerUserId ? (
              <div className="relative z-20 shrink-0 self-start pointer-events-auto">
                <HomeCardFavoriteButton
                  listingId={row.id}
                  isFavorite={favoriteIdSet.has(row.id)}
                  returnTo={favoriteReturnTo}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={listingCardClass}>
      <Link
        href={`/listings/${row.id}`}
        className="absolute inset-0 z-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
        aria-label={listingLabel}
      />
      <div className="relative z-10 flex flex-col gap-2.5 pointer-events-none">
        {coverImage ? (
          <div className="mb-1.5 overflow-hidden rounded-xl border border-zinc-200">
            <Image
              src={coverImage}
              alt=""
              width={224}
              height={144}
              unoptimized
              className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        ) : (
          <div className="mb-1.5 flex h-44 w-full items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-500">
            Ingen bilde
          </div>
        )}
        <div className="flex items-start gap-2.5">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <p className="line-clamp-2 font-semibold text-zinc-900 group-hover:underline">
              {row.title?.trim() || "—"}
            </p>
            <p className="text-xs text-zinc-500">
              {searchSellerDisplay(row.seller_id, sellerUsernameById)}
            </p>
            <ListingCategoryBadge category={row.category} />
            <p className="tabular-nums text-lg font-semibold text-zinc-900">
              {priceText(row.price_nok)}
            </p>
          </div>
          {viewerUserId &&
          row.seller_id &&
          row.seller_id !== viewerUserId ? (
            <div className="relative z-20 shrink-0 self-start pointer-events-auto">
              <HomeCardFavoriteButton
                listingId={row.id}
                isFavorite={favoriteIdSet.has(row.id)}
                returnTo={favoriteReturnTo}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
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

  const selectCols =
    "id, title, description, image_urls, type, category, price_nok, created_at, seller_id, auction_starts_at, auction_ends_at";

  let listingsQuery = supabase
    .from("listings")
    .select(selectCols)
    .or(publicListingFeedOrFilter(nowIso))
    .neq("status", "deleted")
    .in("type", ["auction", "fixed_price"]);

  if (textSearchOr != null) {
    listingsQuery = listingsQuery.or(textSearchOr);
  }

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

  let totalResultsQuery = supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .or(publicListingFeedOrFilter(nowIso))
    .neq("status", "deleted")
    .in("type", ["auction", "fixed_price"]);

  if (textSearchOr != null) {
    totalResultsQuery = totalResultsQuery.or(textSearchOr);
  }

  if (typeFilters.length === 1) {
    totalResultsQuery = totalResultsQuery.eq("type", typeFilters[0]);
  } else if (typeFilters.length > 1) {
    totalResultsQuery = totalResultsQuery.in("type", typeFilters);
  }

  if (categoryFilter !== "all") {
    totalResultsQuery = totalResultsQuery.eq("category", categoryFilter);
  }

  const { count: totalCountRaw, error: countErr } = await totalResultsQuery;

  if (countErr) {
    throw new Error(`Could not count search results: ${countErr.message}`);
  }

  const totalCount = totalCountRaw ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const parsedPage = parsePage(sp.page);
  const currentPage = Math.min(Math.max(1, parsedPage), totalPages);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const { data, error } = await listingsQuery.range(
    offset,
    offset + PAGE_SIZE - 1,
  );

  if (error) {
    throw new Error(`Could not load search results: ${error.message}`);
  }

  const rows = (data ?? []) as SearchListingRow[];

  const buildSearchHref = ({
    types,
    category,
    sort,
    page: pageOverride,
    q: qOverride,
  }: {
    types?: ListingTypeValue[];
    category?: ListingCategoryFilter;
    sort?: ListingSortFilter;
    page?: number;
    q?: string;
  }) => {
    const params = new URLSearchParams();
    const resolvedQ = qOverride !== undefined ? qOverride.trim() : query;
    if (resolvedQ !== "") params.set("q", resolvedQ);
    const resolvedTypes = types ?? typeFilters;
    const resolvedCategory = category ?? categoryFilter;
    const resolvedSort = sort ?? sortFilter;
    const resolvedPage = pageOverride ?? currentPage;
    for (const type of resolvedTypes) {
      params.append("type", type);
    }
    if (resolvedCategory !== "all") params.set("category", resolvedCategory);
    if (resolvedSort !== "newest") params.set("sort", resolvedSort);
    if (resolvedPage > 1) params.set("page", String(resolvedPage));
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
    return buildSearchHref({ types: [...current], page: 1 });
  };

  const favoriteReturnTo = buildSearchHref({});

  const pageItems = paginationItems(currentPage, totalPages);
  const prevHref =
    currentPage > 1 ? buildSearchHref({ page: currentPage - 1 }) : null;
  const nextHref =
    currentPage < totalPages ? buildSearchHref({ page: currentPage + 1 }) : null;

  const categoryCounts = new Map<ListingCategoryFilter, number>();
  for (const category of CATEGORY_FILTERS) {
    let countQuery = supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .or(publicListingFeedOrFilter(nowIso))
      .neq("status", "deleted")
      .in("type", ["auction", "fixed_price"]);
    if (textSearchOr != null) {
      countQuery = countQuery.or(textSearchOr);
    }
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

  const auctionIds = rows
    .filter((r) => r.type === "auction")
    .map((r) => r.id)
    .filter((id): id is string => typeof id === "string" && id !== "");

  let auctionHighestNokById = new Map<string, number>();
  const listingIdsWithAnyAuctionBid = new Set<string>();
  let auctionLeadingBidderByListingId = new Map<string, string | null>();
  if (auctionIds.length > 0) {
    const { data: bidRows, error: bidsErr } = await supabase
      .from("bids")
      .select("listing_id, amount_nok, created_at, bidder_id")
      .in("listing_id", auctionIds);

    if (bidsErr) {
      throw new Error(`Could not load bids: ${bidsErr.message}`);
    }
    const flat = (bidRows ?? []) as BidForLeadingRow[];
    for (const r of flat) {
      const lid = r.listing_id;
      if (lid) listingIdsWithAnyAuctionBid.add(lid);
    }
    auctionLeadingBidderByListingId = leadingBidderIdByListingId(flat);
    auctionHighestNokById = highestNokByListingId(flat as BidWithListingId[]);
  }

  const rangeStart = totalCount === 0 ? 0 : offset + 1;
  const rangeEnd = offset + rows.length;

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <div className="space-y-2">
          <p className="text-sm">
            <Link
              href="/"
              className="font-medium text-zinc-700 underline-offset-2 hover:underline"
            >
              ← Hjem
            </Link>
          </p>
          <h1 className={pageTitleClass}>Søk</h1>
        </div>
        {user ? null : (
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

      <div className={`${pageBodyGapClass} space-y-8`}>
        <section aria-labelledby="search-form-heading">
          <h2
            id="search-form-heading"
            className="text-base font-semibold text-zinc-900"
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
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 placeholder:text-zinc-500 focus-visible:ring-2"
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
                    {CATEGORY_FILTERS.map((item) => {
                      const active = categoryFilter === item.value;
                      const countLabel = categoryCounts.get(item.value);
                      return (
                        <li key={item.value}>
                          <Link
                            href={buildSearchHref({
                              category: item.value,
                              page: 1,
                            })}
                            className={
                              active
                                ? "flex items-center justify-between rounded bg-zinc-100 px-2 py-1.5 text-sm font-medium text-zinc-900"
                                : "flex items-center justify-between rounded px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
                            }
                          >
                            <span>{item.label}</span>
                            <span className="text-xs text-zinc-500">
                              {countLabel ?? 0}
                            </span>
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
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
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
                          ? "inline-flex items-center gap-2 rounded-full border border-blue-600 bg-blue-600 px-3 py-1 text-xs font-medium text-white"
                          : "inline-flex items-center gap-2 rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
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
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Kategori
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {CATEGORY_FILTERS.map((item) => {
                  const active = categoryFilter === item.value;
                  return (
                    <Link
                      key={item.value}
                      href={buildSearchHref({
                        category: item.value,
                        page: 1,
                      })}
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
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Sortering
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SORT_FILTERS.map((item) => {
                  const active = sortFilter === item.value;
                  return (
                    <Link
                      key={item.value}
                      href={buildSearchHref({
                        sort: item.value,
                        page: 1,
                      })}
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
            </div>
          </div>
        </section>

        <section aria-labelledby="search-results-heading">
          <h2
            id="search-results-heading"
            className="text-base font-semibold text-zinc-900"
          >
            Resultater
          </h2>
          <p className="mt-3 text-sm text-zinc-600">
            {query !== "" ? (
              <>
                {totalCount} treff for{" "}
                <span className="font-medium">“{query}”</span>
                {totalCount > 0 ? (
                  <>
                    {" "}
                    (viser {rangeStart}–{rangeEnd})
                  </>
                ) : null}
                .
              </>
            ) : (
              <>
                {totalCount} annonser
                {totalCount > 0 ? (
                  <>
                    {" "}
                    (viser {rangeStart}–{rangeEnd})
                  </>
                ) : null}
                .
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Aktivt filter: {selectedTypeLabel} · {selectedCategoryLabel} ·{" "}
            {selectedSortLabel}
            {totalPages > 1 ? (
              <>
                {" "}
                · Side {currentPage} av {totalPages}
              </>
            ) : null}
          </p>
          {rows.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">
              Ingen annonser matcher søket eller filtrene akkurat nå.
            </p>
          ) : (
            <>
              <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rows.map((row) => (
                  <li key={row.id} className="min-w-0">
                    <SearchListingCard
                      row={row}
                      nowMs={nowMs}
                      sellerUsernameById={sellerUsernameById}
                      viewerUserId={user?.id ?? null}
                      auctionHighestNokById={auctionHighestNokById}
                      listingIdsWithAnyAuctionBid={listingIdsWithAnyAuctionBid}
                      auctionLeadingBidderByListingId={
                        auctionLeadingBidderByListingId
                      }
                      favoriteIdSet={favoriteIdSet}
                      favoriteReturnTo={favoriteReturnTo}
                    />
                  </li>
                ))}
              </ul>
              {totalPages > 1 ? (
                <nav
                  className="mt-8 flex flex-col items-center gap-4 border-t border-zinc-200 pt-6"
                  aria-label="Paginering"
                >
                  <div className="flex flex-wrap items-center justify-center gap-1">
                    {prevHref ? (
                      <Link
                        href={prevHref}
                        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
                      >
                        ← previous
                      </Link>
                    ) : (
                      <span className="rounded-md border border-transparent px-3 py-2 text-sm text-zinc-400">
                        ← previous
                      </span>
                    )}
                    <div className="flex flex-wrap items-center justify-center gap-1 px-2">
                      {pageItems.map((item, idx) =>
                        item === "ellipsis" ? (
                          <span
                            key={`e-${idx}`}
                            className="px-2 text-sm text-zinc-500"
                            aria-hidden
                          >
                            …
                          </span>
                        ) : (
                          <Link
                            key={item}
                            href={buildSearchHref({ page: item })}
                            className={
                              item === currentPage
                                ? "inline-flex min-w-[2.25rem] items-center justify-center rounded-md border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
                                : "inline-flex min-w-[2.25rem] items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
                            }
                            aria-current={
                              item === currentPage ? "page" : undefined
                            }
                          >
                            {item}
                          </Link>
                        ),
                      )}
                    </div>
                    {nextHref ? (
                      <Link
                        href={nextHref}
                        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
                      >
                        next →
                      </Link>
                    ) : (
                      <span className="rounded-md border border-transparent px-3 py-2 text-sm text-zinc-400">
                        next →
                      </span>
                    )}
                  </div>
                </nav>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
