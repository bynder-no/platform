/** Persisted auction result (not deal outcome). */
export type AuctionOutcomeStored =
  | "pending"
  | "no_bids"
  | "threshold_not_met"
  | "deal_opened";

import { createClient } from "@/lib/supabase/server";
import { qualifiesAuctionContactFromHighestBid } from "@/lib/auction-contact-qualification";

/**
 * Terminal `auction_outcome` for an auction whose end time is in the past.
 * Must stay aligned with `apply_listing_auction_outcome_if_pending` in SQL.
 *
 * Order (exclusive):
 * 1. listing_deals row exists → deal_opened
 * 2. no bids → no_bids
 * 3. bids but contact/threshold not satisfied → threshold_not_met
 * 4. else (bids + contact qualified) → deal_opened
 */
export function resolveTerminalAuctionOutcome(
  listingType: string | null,
  auctionTimeEnded: boolean,
  hasListingDealsRow: boolean,
  hasAuctionBids: boolean,
  contactUnlockedPostAuction: boolean,
): "no_bids" | "threshold_not_met" | "deal_opened" | null {
  if (listingType !== "auction" || !auctionTimeEnded) {
    return null;
  }
  if (hasListingDealsRow) {
    return "deal_opened";
  }
  if (!hasAuctionBids) {
    return "no_bids";
  }
  if (!contactUnlockedPostAuction) {
    return "threshold_not_met";
  }
  return "deal_opened";
}

export function normalizeStoredAuctionOutcome(
  raw: string | null | undefined,
): AuctionOutcomeStored {
  const s = String(raw ?? "pending").trim();
  if (
    s === "no_bids" ||
    s === "threshold_not_met" ||
    s === "deal_opened" ||
    s === "pending"
  ) {
    return s;
  }
  return "pending";
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
export type AuctionOutcomeDecision = {
  listingId: string;
  highestBid: number | null;
  qualifies: boolean;
  hasDealRow: boolean;
  nextOutcome: "no_bids" | "threshold_not_met" | "deal_opened";
};

export function isPostAuctionContactQualifiedByHighestBid(
  useReservePrice: boolean,
  reservePriceNok: number | string | null,
  contactThresholdPercent: number | string | null,
  highestBidNok: number,
  hasAuctionBids: boolean,
): boolean {
  return qualifiesAuctionContactFromHighestBid({
    useReservePrice,
    reservePriceNok,
    contactThresholdPercent,
    highestBid: highestBidNok,
    hasBids: hasAuctionBids,
  });
}

export async function resolveAndPersistEndedAuctionOutcomeForListing(
  supabase: SupabaseServerClient,
  listingId: string,
): Promise<AuctionOutcomeDecision | null> {
  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select(
      "type, auction_ends_at, auction_outcome, use_reserve_price, reserve_price_nok, contact_threshold_percent",
    )
    .eq("id", listingId)
    .maybeSingle();

  if (listingErr) {
    console.error("resolve auction_outcome listing lookup:", listingErr.message);
    return null;
  }
  if (!listing) return null;

  const storedOutcome = normalizeStoredAuctionOutcome(listing.auction_outcome);
  const endsAtMs = listing.auction_ends_at
    ? new Date(listing.auction_ends_at).getTime()
    : Number.NaN;
  const ended = Number.isFinite(endsAtMs) && Date.now() >= endsAtMs;
  if (listing.type !== "auction" || !ended) {
    return null;
  }

  console.log("CHECK DEAL ROW", { listingId });
  const { data: dealRow, error: dealErr } = await supabase
    .from("listing_deals")
    .select("listing_id")
    .eq("listing_id", listingId)
    .limit(1)
    .maybeSingle();
  if (dealErr) {
    console.error("resolve auction_outcome listing_deals lookup:", dealErr.message);
    return null;
  }

  // Deal flow is authoritative. If a deal row exists, force deal_opened unless already set.
  if (dealRow && storedOutcome !== "deal_opened") {
    console.log("AUCTION OUTCOME DECISION", {
      listingId,
      highestBid: null,
      reservePrice: listing.reserve_price_nok,
      contactThresholdPercent: listing.contact_threshold_percent,
      qualifies: true,
      hasDealRow: true,
      nextOutcome: "deal_opened",
    });
    console.log("WON PATH CHECK", {
      listingId,
      hasDealRow: true,
      highestBid: null,
      qualifies: true,
      nextOutcome: "deal_opened",
    });
    const { error: forceDealOpenedErr } = await supabase
      .from("listings")
      .update({ auction_outcome: "deal_opened" })
      .eq("id", listingId);
    if (forceDealOpenedErr) {
      console.error(
        "resolve auction_outcome force deal_opened update:",
        forceDealOpenedErr.message,
      );
    } else {
      console.log("AUCTION OUTCOME SET DEAL_OPENED FROM DEAL ROW", {
        listingId,
      });
    }
    return {
      listingId,
      highestBid: null,
      qualifies: true,
      hasDealRow: true,
      nextOutcome: "deal_opened",
    };
  }

  if (storedOutcome !== "pending") {
    return null;
  }

  const { data: topBid, error: topBidErr } = await supabase
    .from("bids")
    .select("amount_nok")
    .eq("listing_id", listingId)
    .order("amount_nok", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (topBidErr) {
    console.error("resolve auction_outcome top bid lookup:", topBidErr.message);
    return null;
  }

  const highestBidNok =
    topBid?.amount_nok != null && Number.isFinite(Number(topBid.amount_nok))
      ? Math.trunc(Number(topBid.amount_nok))
      : 0;
  const hasAuctionBids = topBid != null;
  const qualifies = isPostAuctionContactQualifiedByHighestBid(
    listing.use_reserve_price === true,
    listing.reserve_price_nok,
    listing.contact_threshold_percent,
    highestBidNok,
    hasAuctionBids,
  );
  console.log("SHARED QUAL CHECK OUTCOME", {
    listingId,
    useReservePrice: listing.use_reserve_price === true,
    reservePriceNok: listing.reserve_price_nok,
    contactThresholdPercent: listing.contact_threshold_percent,
    highestBid: highestBidNok,
    hasBids: hasAuctionBids,
    qualifies,
  });

  let nextOutcome: "no_bids" | "threshold_not_met" | "deal_opened";
  if (dealRow) {
    nextOutcome = "deal_opened";
  } else if (!hasAuctionBids) {
    nextOutcome = "no_bids";
  } else if (qualifies) {
    nextOutcome = "deal_opened";
  } else {
    nextOutcome = "threshold_not_met";
  }

  console.log("AUCTION OUTCOME DECISION", {
    listingId,
    highestBid: highestBidNok,
    useReservePrice: listing.use_reserve_price === true,
    reservePriceNok: listing.reserve_price_nok,
    contactThresholdPercent: listing.contact_threshold_percent,
    qualifies,
    nextOutcome,
  });
  if (nextOutcome === "deal_opened") {
    console.log("WON PATH CHECK", {
      listingId,
      hasDealRow: Boolean(dealRow),
      highestBid: highestBidNok,
      qualifies,
      nextOutcome,
    });
  }

  const { error: updateErr } = await supabase
    .from("listings")
    .update({ auction_outcome: nextOutcome })
    .eq("id", listingId)
    .eq("auction_outcome", "pending");
  if (updateErr) {
    console.error("resolve auction_outcome update:", updateErr.message);
  }
  return {
    listingId,
    highestBid: highestBidNok,
    qualifies,
    hasDealRow: Boolean(dealRow),
    nextOutcome,
  };
}

export async function forceDealOpenedOutcomeIfPending(
  supabase: SupabaseServerClient,
  listingId: string,
): Promise<void> {
  const { error } = await supabase
    .from("listings")
    .update({ auction_outcome: "deal_opened" })
    .eq("id", listingId)
    .in("auction_outcome", ["pending", "threshold_not_met"])
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("force deal_opened auction_outcome update:", error.message);
    return;
  }

  console.log("SET DEAL_OPENED FROM DEAL FLOW", { listingId });
}
