import Link from "next/link";

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

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

type PageProps = {
  searchParams: Promise<{ offset?: string | string[] }>;
};

type AuctionRow = {
  id: string;
  title: string | null;
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

export default async function PublicAuctionsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const offset = parseOffset(sp.offset);

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

  const selectCols =
    "id, title, auction_starts_at, auction_ends_at, created_at, seller_id";

  const { data: rawListings, error: listingsErr } = await supabase
    .from("listings")
    .select(selectCols)
    .or(publicListingFeedOrFilter(nowIso))
    .eq("type", "auction")
    .order("created_at", { ascending: false })
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

  const nextOffset = offset + PAGE_SIZE;
  const nextHref = `/auctions?offset=${nextOffset}`;
  const favoriteReturnTo =
    offset === 0 ? "/auctions" : `/auctions?offset=${offset}`;

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
          <h1 className={pageTitleClass}>Live auksjoner</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Offentlig oversikt over auksjoner som pågår nå.
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

      <section className={pageBodyGapClass}>
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Ingen live auksjoner akkurat nå.
          </p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-3">
              {rows.map((row) => {
                const state = auctionStateLabelNo(
                  nowMs,
                  row.auction_starts_at ?? null,
                  row.auction_ends_at ?? null,
                );
                const liveNok = highestById.get(row.id) ?? 0;
                const bidPositionLabel =
                  user != null && row.seller_id !== user.id
                    ? viewerAuctionBidPositionLabel(
                        user.id,
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
                  <li key={row.id}>
                    <div
                      className={`${cardClass} hover:border-zinc-300 dark:hover:border-zinc-600`}
                    >
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
                              user?.id ?? null,
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
                        {user &&
                        row.seller_id &&
                        row.seller_id !== user.id ? (
                          <HomeCardFavoriteButton
                            listingId={row.id}
                            isFavorite={favoriteIdSet.has(row.id)}
                            returnTo={favoriteReturnTo}
                          />
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
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
  );
}
