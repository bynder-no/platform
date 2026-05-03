import { redirect } from "next/navigation";

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
import { type BidForLeadingRow } from "@/lib/auction-viewer-bid-status";
import { resolvePendingEndedAuctions } from "@/lib/auction-resolution";

import { DashboardFollowedAuctionsGrid } from "./dashboard-followed-auctions-grid";

export const dynamic = "force-dynamic";

const sectionHeadingClass =
  "text-sm font-semibold text-zinc-900";

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

const TRACKED_LIVE_AUCTIONS_LIMIT = 4;

type TrackedAuctionListingRow = {
  id: string;
  title: string | null;
  type: string | null;
  category: string | null;
  image_urls: unknown;
  auction_starts_at: string | null;
  auction_ends_at: string | null;
  seller_id: string | null;
  price_nok: number | string | null;
  min_bid_increment_nok: number | string | null;
};

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
  let bidRowsForListings: BidForLeadingRow[] = [];

  const userBidListingIds = [
    ...new Set(
      (trackedBidRows ?? [])
        .map((r) => r.listing_id)
        .filter((id): id is string => typeof id === "string" && id !== ""),
    ),
  ];

  const trackedIds = [...trackedListingIdSet];
  if (trackedIds.length > 0) {
    const { data: trackedAuctionListings, error: trackedListErr } =
      await supabase
        .from("listings")
        .select(
          "id, title, type, category, image_urls, auction_starts_at, auction_ends_at, seller_id, price_nok, min_bid_increment_nok",
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
      bidRowsForListings = trackedFlat;
      highestNokTrackedFollow = highestNokByListingId(
        trackedFlat as BidWithListingId[],
      );
    }
  }

  const dashboardSellerUsernameById = new Map<string, string>();
  const dashSellerIds = [
    ...new Set(
      trackedLiveAuctions
        .map((l) => l.seller_id)
        .filter((id): id is string => typeof id === "string" && id !== ""),
    ),
  ];
  if (dashSellerIds.length > 0) {
    const { data: dashSellerProfiles, error: dashSellerErr } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", dashSellerIds);

    if (dashSellerErr) {
      throw new Error(
        `Could not load seller profiles: ${dashSellerErr.message}`,
      );
    }
    for (const p of dashSellerProfiles ?? []) {
      const u = typeof p.username === "string" ? p.username.trim() : "";
      if (p.id && u !== "") dashboardSellerUsernameById.set(p.id, u);
    }
  }

  const highestNokByListingIdRecord = Object.fromEntries(highestNokTrackedFollow);
  const sellerUsernameByIdRecord = Object.fromEntries(
    dashboardSellerUsernameById,
  );

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <h1 className={pageTitleClass}>Dashboard</h1>
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
            <p className="mt-3 text-sm text-zinc-600">
              Ingen pågående auksjoner her. Legg inn bud eller lagre som favoritt
              for å se live auksjoner du følger.
            </p>
          ) : (
            <DashboardFollowedAuctionsGrid
              auctions={trackedLiveAuctions}
              userId={user.id}
              userBidListingIds={userBidListingIds}
              highestNokByListingId={highestNokByListingIdRecord}
              bidRowsForListings={bidRowsForListings}
              sellerUsernameById={sellerUsernameByIdRecord}
              nowMs={nowMs}
            />
          )}
        </section>
      </div>
      </div>
    </div>
  );
}
