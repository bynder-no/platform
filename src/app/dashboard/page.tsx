import Link from "next/link";
import { redirect } from "next/navigation";

import { SignedInNavLinks } from "@/components/signed-in-nav-links";
import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";

import {
  highestNokByListingId,
  type BidWithListingId,
} from "@/lib/highest-bid-nok";
import {
  leadingBidderIdByListingId,
  viewerAuctionBidPositionLabel,
  type BidForLeadingRow,
} from "@/lib/auction-viewer-bid-status";
import { resolvePendingEndedAuctions } from "@/lib/auction-resolution";

import { DashboardCustomBidForm } from "./dashboard-custom-bid-form";
import { DashboardQuickBidForm } from "./dashboard-quick-bid-form";

export const dynamic = "force-dynamic";

const sectionHeadingClass =
  "text-sm font-semibold text-zinc-900 dark:text-zinc-50";

/** Live auction window: started and not yet ended (same instant boundaries as timing label). */
function isAuctionLiveNow(
  row: { type: string | null; auction_starts_at: string | null; auction_ends_at: string | null },
  nowMs: number,
): boolean {
  if (row.type !== "auction") return false;
  const startsAtMs = row.auction_starts_at
    ? new Date(row.auction_starts_at).getTime()
    : Number.NaN;
  const endsAtMs = row.auction_ends_at
    ? new Date(row.auction_ends_at).getTime()
    : Number.NaN;
  if (!Number.isFinite(startsAtMs) || !Number.isFinite(endsAtMs)) return false;
  return nowMs >= startsAtMs && nowMs < endsAtMs;
}

function formatAuctionTimeRemainingNo(endMs: number, nowMs: number): string {
  const ms = endMs - nowMs;
  if (ms <= 0) return "Avsluttet";
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 60) return `${totalMin} min igjen`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours < 24) {
    return mins > 0 ? `${hours} t ${mins} min igjen` : `${hours} t igjen`;
  }
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  return h > 0 ? `${days} d ${h} t igjen` : `${days} d igjen`;
}

const TRACKED_LIVE_AUCTIONS_LIMIT = 4;

type TrackedAuctionListingRow = {
  id: string;
  title: string | null;
  type: string | null;
  auction_starts_at: string | null;
  auction_ends_at: string | null;
  seller_id: string | null;
  price_nok: number | string | null;
  min_bid_increment_nok: number | string | null;
};

function dashboardQuickBidAmountNok(
  hasAnyBid: boolean,
  highestNok: number,
  priceNok: number | string | null,
  minIncrementNok: number | string | null,
): number | null {
  const startPriceNok =
    priceNok != null && Number.isFinite(Number(priceNok))
      ? Math.trunc(Number(priceNok))
      : null;
  const minBidIncrementNok =
    minIncrementNok != null && Number.isFinite(Number(minIncrementNok))
      ? Math.trunc(Number(minIncrementNok))
      : null;
  if (startPriceNok == null || startPriceNok < 1) return null;
  if (minBidIncrementNok == null || minBidIncrementNok < 1) return null;
  if (!hasAnyBid) return startPriceNok;
  return highestNok + minBidIncrementNok;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  await resolvePendingEndedAuctions(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingProfile) {
    const { error: insertError } = await supabase
      .from("profiles")
      .insert({ id: user.id });

    if (insertError) {
      throw new Error(`Could not create profile: ${insertError.message}`);
    }
  }

  const now = new Date();
  const nowMs = now.getTime();

  const { data: favoriteRows, error: favoritesError } = await supabase
    .from("favorites")
    .select("listing_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (favoritesError) {
    throw new Error(`Could not load favorites: ${favoritesError.message}`);
  }

  const favList = favoriteRows ?? [];
  const favListingIds = favList
    .map((r) => r.listing_id)
    .filter((id): id is string => typeof id === "string" && id !== "");
  type FavListingLite = { id: string; title: string | null; type: string | null };
  let favListingsOrdered: FavListingLite[] = [];
  if (favListingIds.length > 0) {
    const { data: favListings, error: favListErr } = await supabase
      .from("listings")
      .select("id, title, type")
      .in("id", favListingIds);

    if (favListErr) {
      throw new Error(`Could not load favorite listings: ${favListErr.message}`);
    }
    const byId = new Map((favListings ?? []).map((l) => [l.id, l as FavListingLite]));
    favListingsOrdered = favList
      .map((f) => byId.get(f.listing_id))
      .filter((l): l is FavListingLite => Boolean(l));
  }

  const { data: trackedBidRows, error: trackedBidsErr } = await supabase
    .from("bids")
    .select("listing_id")
    .eq("bidder_id", user.id);

  if (trackedBidsErr) {
    throw new Error(`Could not load bids for tracking: ${trackedBidsErr.message}`);
  }

  const { data: trackedFavRows, error: trackedFavErr } = await supabase
    .from("favorites")
    .select("listing_id")
    .eq("user_id", user.id);

  if (trackedFavErr) {
    throw new Error(
      `Could not load favorites for tracking: ${trackedFavErr.message}`,
    );
  }

  const trackedListingIdSet = new Set<string>();
  for (const r of trackedBidRows ?? []) {
    const lid = r.listing_id;
    if (typeof lid === "string" && lid !== "") trackedListingIdSet.add(lid);
  }
  for (const r of trackedFavRows ?? []) {
    const lid = r.listing_id;
    if (typeof lid === "string" && lid !== "") trackedListingIdSet.add(lid);
  }

  let trackedLiveAuctions: TrackedAuctionListingRow[] = [];
  let highestNokTrackedFollow = new Map<string, number>();
  const trackedListingIdsWithAnyBid = new Set<string>();
  let trackedLeadingBidderByListingId = new Map<string, string | null>();

  const trackedIds = [...trackedListingIdSet];
  if (trackedIds.length > 0) {
    const { data: trackedAuctionListings, error: trackedListErr } =
      await supabase
        .from("listings")
        .select(
          "id, title, type, auction_starts_at, auction_ends_at, seller_id, price_nok, min_bid_increment_nok",
        )
        .in("id", trackedIds)
        .eq("type", "auction");

    if (trackedListErr) {
      throw new Error(
        `Could not load tracked auction listings: ${trackedListErr.message}`,
      );
    }

    const liveTracked = (trackedAuctionListings ?? []).filter(
      (l): l is TrackedAuctionListingRow =>
        Boolean(l.id) &&
        isAuctionLiveNow(
          {
            type: l.type,
            auction_starts_at: l.auction_starts_at,
            auction_ends_at: l.auction_ends_at,
          },
          nowMs,
        ),
    );

    liveTracked.sort((a, b) => {
      const ea = a.auction_ends_at
        ? new Date(a.auction_ends_at).getTime()
        : Number.POSITIVE_INFINITY;
      const eb = b.auction_ends_at
        ? new Date(b.auction_ends_at).getTime()
        : Number.POSITIVE_INFINITY;
      return ea - eb;
    });

    trackedLiveAuctions = liveTracked.slice(0, TRACKED_LIVE_AUCTIONS_LIMIT);

    const trackedTopIds = trackedLiveAuctions.map((l) => l.id).filter(Boolean);
    if (trackedTopIds.length > 0) {
      const { data: trackedBidAmountRows, error: trackedBidAmtErr } =
        await supabase
          .from("bids")
          .select("listing_id, amount_nok, created_at, bidder_id")
          .in("listing_id", trackedTopIds);

      if (trackedBidAmtErr) {
        throw new Error(
          `Could not load bids for followed auctions: ${trackedBidAmtErr.message}`,
        );
      }
      const trackedFlat = (trackedBidAmountRows ?? []) as BidForLeadingRow[];
      for (const r of trackedFlat) {
        const lid = r.listing_id;
        if (lid) trackedListingIdsWithAnyBid.add(lid);
      }
      trackedLeadingBidderByListingId =
        leadingBidderIdByListingId(trackedFlat);
      highestNokTrackedFollow = highestNokByListingId(
        trackedFlat as BidWithListingId[],
      );
    }
  }

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <h1 className={pageTitleClass}>Dashboard</h1>
        <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            Innlogget som{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {user.email ?? "—"}
            </span>
          </p>
          <p className="font-mono text-xs text-zinc-500 dark:text-zinc-500">
            {user.id}
          </p>
        </div>
        <SignedInNavLinks />
        <p className="text-sm">
          <Link
            href="/create"
            className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
          >
            Opprett annonse
          </Link>
        </p>
      </header>

      <div className={`${pageBodyGapClass} space-y-10`}>
        <section aria-labelledby="dash-followed-auctions-heading">
          <h2
            id="dash-followed-auctions-heading"
            className={sectionHeadingClass}
          >
            Auksjoner du følger
          </h2>
          {trackedLiveAuctions.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Ingen pågående auksjoner her. Legg inn bud eller lagre som favoritt
              for å se live auksjoner du følger.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
              {trackedLiveAuctions.map((row) => {
                const endMs = row.auction_ends_at
                  ? new Date(row.auction_ends_at).getTime()
                  : Number.NaN;
                const endLabel = row.auction_ends_at
                  ? new Date(row.auction_ends_at).toLocaleString()
                  : "—";
                const remaining = Number.isFinite(endMs)
                  ? formatAuctionTimeRemainingNo(endMs, nowMs)
                  : "—";
                const hasAnyBid = highestNokTrackedFollow.has(row.id);
                const high = hasAnyBid
                  ? (highestNokTrackedFollow.get(row.id) ?? 0)
                  : 0;
                const bidPositionLabel =
                  row.seller_id !== user.id
                    ? viewerAuctionBidPositionLabel(
                        user.id,
                        trackedListingIdsWithAnyBid.has(row.id),
                        trackedLeadingBidderByListingId.get(row.id) ?? null,
                      )
                    : null;
                const quickAmount = dashboardQuickBidAmountNok(
                  hasAnyBid,
                  high,
                  row.price_nok,
                  row.min_bid_increment_nok,
                );
                const showQuickBid =
                  quickAmount != null &&
                  row.seller_id != null &&
                  row.seller_id !== user.id;
                return (
                  <li
                    key={row.id}
                    className="flex flex-col gap-3 px-3 py-4 text-sm"
                  >
                    <Link
                      href={`/listings/${row.id}`}
                      className="line-clamp-2 text-base font-semibold leading-snug text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                    >
                      {row.title?.trim() || "—"}
                    </Link>
                    <div className="flex flex-col gap-1.5 text-zinc-600 dark:text-zinc-400">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                          Live
                        </span>
                        <span className="tabular-nums font-medium text-zinc-800 dark:text-zinc-200">
                          {high} NOK
                        </span>
                        {bidPositionLabel ? (
                          <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
                            {bidPositionLabel}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-0.5 text-xs text-zinc-500 dark:text-zinc-400 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3 sm:gap-y-1">
                        <span>Slutter {endLabel}</span>
                        <span className="tabular-nums">{remaining}</span>
                      </div>
                    </div>
                    {showQuickBid ? (
                      <div className="flex w-full flex-col gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-700 sm:max-w-md sm:self-end">
                        <DashboardQuickBidForm
                          listingId={row.id}
                          amountNok={quickAmount}
                        />
                        <DashboardCustomBidForm
                          listingId={row.id}
                          minNextBidNok={quickAmount}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="dash-fav-heading">
          <h2 id="dash-fav-heading" className={sectionHeadingClass}>
            Favoritter
          </h2>
          {favListingsOrdered.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Ingen favoritter ennå. Lagre annonser fra annonsesiden.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
              {favListingsOrdered.map((row) => {
                const rawType =
                  typeof row.type === "string" ? row.type.trim() : "";
                const typeLabel =
                  rawType === "auction"
                    ? "Auksjon"
                    : rawType === "fixed_price"
                      ? "Fastpris"
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
                      {row.title?.trim() || "—"}
                    </Link>
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {typeLabel}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
