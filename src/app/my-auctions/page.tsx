import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { resolvePendingEndedAuctions } from "@/lib/auction-resolution";
import { qualifiesAuctionContactFromHighestBid } from "@/lib/auction-contact-qualification";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";
import {
  dealStatusGroupLabel,
  resolveDealStatusGroup,
  type DealStatusGroup,
} from "./deal-status-ui";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    tab?: string | string[];
    type?: string | string[];
    listing?: string | string[];
    q?: string | string[];
  }>;
};

type BidRow = {
  listing_id: string;
  amount_nok: number | string | null;
  created_at: string | null;
  bidder_id: string;
};

function leadingBidForListing(bids: BidRow[]): {
  highestNok: number;
  leadingBidderId: string | null;
} {
  let highestNok = 0;
  let leading: BidRow | null = null;
  for (const b of bids) {
    const n = Number(b.amount_nok);
    if (!Number.isFinite(n)) continue;
    if (!leading || n > highestNok) {
      highestNok = n;
      leading = b;
    } else if (n === highestNok && leading) {
      const tNew = b.created_at ? new Date(b.created_at).getTime() : -1;
      const tOld = leading.created_at
        ? new Date(leading.created_at).getTime()
        : -1;
      if (tNew > tOld) leading = b;
    }
  }
  return {
    highestNok,
    leadingBidderId: leading?.bidder_id ?? null,
  };
}

type DealRowLite = {
  listing_id: string;
  seller_decision: string;
  bidder_decision: string;
  buyer_received_card: boolean;
  seller_received_payment: boolean;
  completed_at: string | null;
};

type FixedPriceDealLite = {
  listing_id: string;
  seller_id: string;
  bidder_id: string;
  seller_decision: string;
  bidder_decision: string;
  buyer_received_card: boolean;
  seller_received_payment: boolean;
  offer_price_nok: number | string | null;
};


function isPgBoolTrue(value: unknown): boolean {
  return value === true;
}

function normalizeCompletedAtIso(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (s === "" || s.toLowerCase() === "null") return null;
  return s;
}

function isEndedAuctionForMyAuctionsPage(
  row: { auction_ends_at: string | null; auction_starts_at: string | null },
  nowIso: string,
): boolean {
  const nowMs = new Date(nowIso).getTime();
  if (!row.auction_ends_at) return false;
  const endMs = new Date(row.auction_ends_at).getTime();
  if (!Number.isFinite(endMs) || endMs > nowMs) return false;
  if (row.auction_starts_at) {
    const startMs = new Date(row.auction_starts_at).getTime();
    if (Number.isFinite(startMs) && startMs > nowMs) return false;
  }
  return true;
}

type PostAuctionOutcomeGroup = DealStatusGroup;

function isSellerDealFullyCompleted(deal: DealRowLite): boolean {
  return (
    deal.seller_decision === "deal" &&
    deal.bidder_decision === "deal" &&
    deal.buyer_received_card === true &&
    deal.seller_received_payment === true &&
    deal.completed_at != null
  );
}

/** Grouping for ended-auction outcome (seller «Mine salg» + bidder «Mine kjøp»). */
/**
 * Short action/wait line for deal cards (same state the status line uses; display only).
 */
function dealCardHandlingHint(
  viewerRole: "seller" | "bidder",
  deal: DealRowLite | null | undefined,
  group: PostAuctionOutcomeGroup,
): "Krever handling fra deg" | "Venter på motpart" | null {
  if (group === "no_deal" || group === "deal_fullfort") {
    return "Venter på motpart";
  }
  if (group === "deal_venter") {
    const s = deal?.seller_decision ?? "pending";
    const b = deal?.bidder_decision ?? "pending";
    const mine = viewerRole === "seller" ? s : b;
    const theirs = viewerRole === "seller" ? b : s;
    if (mine === "pending") return "Krever handling fra deg";
    if (theirs === "pending") return "Venter på motpart";
    return "Venter på motpart";
  }
  // deal_bekreftet
  if (!deal) return null;
  if (deal.seller_decision !== "deal" || deal.bidder_decision !== "deal") {
    return "Venter på motpart";
  }
  if (!deal.buyer_received_card) {
    return viewerRole === "bidder"
      ? "Krever handling fra deg"
      : "Venter på motpart";
  }
  if (!deal.seller_received_payment) {
    return viewerRole === "seller"
      ? "Krever handling fra deg"
      : "Venter på motpart";
  }
  return "Venter på motpart";
}

function fixedDealHandlingHint(
  viewerRole: "seller" | "buyer",
  row: {
    group: DealStatusGroup;
    sellerDecision: string;
    bidderDecision: string;
    buyerReceivedCard: boolean;
    sellerReceivedPayment: boolean;
  },
): "Krever handling fra deg" | "Venter på motpart" {
  if (row.group === "no_deal" || row.group === "deal_fullfort") {
    return "Venter på motpart";
  }
  if (row.group === "deal_venter") {
    const mine = viewerRole === "seller" ? row.sellerDecision : row.bidderDecision;
    return mine === "pending" ? "Krever handling fra deg" : "Venter på motpart";
  }
  if (row.group === "deal_bekreftet") {
    if (!row.buyerReceivedCard) {
      return viewerRole === "buyer" ? "Krever handling fra deg" : "Venter på motpart";
    }
    if (!row.sellerReceivedPayment) {
      return viewerRole === "seller" ? "Krever handling fra deg" : "Venter på motpart";
    }
  }
  return "Venter på motpart";
}

function postAuctionOutcomeGroup(
  deal: DealRowLite | null | undefined,
  hasBids: boolean,
  contactUnlocked: boolean,
): PostAuctionOutcomeGroup {
  if (!hasBids) return "no_deal";
  if (!contactUnlocked) return "no_deal";
  if (!deal) return "deal_venter";
  return resolveDealStatusGroup({
    sellerDecision: deal.seller_decision,
    bidderDecision: deal.bidder_decision,
    buyerReceivedCard: deal.buyer_received_card,
    sellerReceivedPayment: deal.seller_received_payment,
    isCompleted: isSellerDealFullyCompleted(deal),
  });
}

export default async function MyAuctionsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  await resolvePendingEndedAuctions(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const sp = await searchParams;
  const tabParam = sp.tab;
  const activeTab =
    typeof tabParam === "string" && tabParam === "deals" ? "deals" : "annonser";
  const typeParam = sp.type;
  const activeType =
    typeof typeParam === "string" && typeParam === "fixed_price"
      ? "fixed_price"
      : "auction";
  const searchParam = sp.q;
  const searchQueryRaw = typeof searchParam === "string" ? searchParam : "";
  const searchQuery = searchQueryRaw.trim();
  const normalizedSearchQuery = searchQuery.toLocaleLowerCase();

  type SellerMineRow = {
    id: string;
    title: string | null;
    auction_starts_at: string | null;
    auction_ends_at: string | null;
    seller_id: string;
    use_reserve_price: boolean;
    reserve_price_nok: number | string | null;
    contact_threshold_percent: number | string | null;
  };

  type BidderWinRow = {
    id: string;
    title: string | null;
    auction_starts_at: string | null;
    auction_ends_at: string | null;
    seller_id: string;
    use_reserve_price: boolean;
    reserve_price_nok: number | string | null;
    contact_threshold_percent: number | string | null;
  };

  let sellerRows: SellerMineRow[] = [];
  let bidderWinRows: BidderWinRow[] = [];
  let fixedSellerDeals: FixedPriceDealLite[] = [];
  let fixedBuyerDeals: FixedPriceDealLite[] = [];
  const bidsByListing = new Map<string, BidRow[]>();
  const dealsByListing = new Map<string, DealRowLite>();
  const nowIso = new Date().toISOString();

  const { data: sellerListingsRaw, error: sellerErr } = await supabase
    .from("listings")
    .select(
      "id, title, auction_starts_at, auction_ends_at, seller_id, use_reserve_price, reserve_price_nok, contact_threshold_percent",
    )
    .eq("type", "auction")
    .not("auction_ends_at", "is", null)
    .lte("auction_ends_at", nowIso)
    .eq("seller_id", user.id);

  if (sellerErr) {
    throw new Error(`Could not load auctions: ${sellerErr.message}`);
  }

  sellerRows = (sellerListingsRaw ?? [])
    .filter((l) => isEndedAuctionForMyAuctionsPage(l, nowIso))
    .map((l) => ({
      id: l.id,
      title: l.title,
      auction_starts_at: l.auction_starts_at,
      auction_ends_at: l.auction_ends_at,
      seller_id: String(l.seller_id ?? ""),
      use_reserve_price: l.use_reserve_price === true,
      reserve_price_nok: l.reserve_price_nok,
      contact_threshold_percent: l.contact_threshold_percent,
    }));

  const { data: myBidRows, error: myBidsErr } = await supabase
    .from("bids")
    .select("listing_id")
    .eq("bidder_id", user.id);

  if (myBidsErr) {
    throw new Error(`Could not load bids: ${myBidsErr.message}`);
  }

  const sellerListingIdSet = new Set(sellerRows.map((l) => l.id));
  const bidListingIds = [
    ...new Set(
      (myBidRows ?? [])
        .map((r) => r.listing_id)
        .filter((id): id is string => typeof id === "string" && id !== ""),
    ),
  ].filter((id) => !sellerListingIdSet.has(id));

  if (bidListingIds.length > 0) {
    const { data: bidderCandidates, error: bidderListErr } = await supabase
      .from("listings")
      .select(
        "id, title, auction_starts_at, auction_ends_at, seller_id, use_reserve_price, reserve_price_nok, contact_threshold_percent",
      )
      .eq("type", "auction")
      .not("auction_ends_at", "is", null)
      .lte("auction_ends_at", nowIso)
      .in("id", bidListingIds);

    if (bidderListErr) {
      throw new Error(`Could not load auctions: ${bidderListErr.message}`);
    }

    const endedBidderCandidates = (bidderCandidates ?? []).filter((l) =>
      isEndedAuctionForMyAuctionsPage(l, nowIso),
    );

    const candidateIds = endedBidderCandidates.map((l) => l.id);
    if (candidateIds.length > 0) {
      const { data: bidRows, error: bidsErr } = await supabase
        .from("bids")
        .select("listing_id, amount_nok, created_at, bidder_id")
        .in("listing_id", candidateIds)
        .order("created_at", { ascending: true });

      if (bidsErr) {
        throw new Error(`Could not load bids: ${bidsErr.message}`);
      }

      const byListing = new Map<string, BidRow[]>();
      for (const b of bidRows ?? []) {
        const lid = b.listing_id;
        if (!lid) continue;
        const arr = byListing.get(lid) ?? [];
        arr.push(b as BidRow);
        byListing.set(lid, arr);
      }

      const won = new Set<string>();
      const candidateById = new Map(
        endedBidderCandidates.map((candidate) => [candidate.id, candidate] as const),
      );
      for (const lid of candidateIds) {
        const listingBids = byListing.get(lid) ?? [];
        const { highestNok, leadingBidderId } = leadingBidForListing(listingBids);
        const candidate = candidateById.get(lid);
        if (!candidate) continue;
        const contactUnlocked = qualifiesAuctionContactFromHighestBid({
          useReservePrice: candidate.use_reserve_price === true,
          reservePriceNok: candidate.reserve_price_nok,
          contactThresholdPercent: candidate.contact_threshold_percent,
          highestBid: highestNok,
          hasBids: listingBids.length > 0,
        });
        if (leadingBidderId === user.id && contactUnlocked) {
          won.add(lid);
        }
      }

      bidderWinRows = endedBidderCandidates
        .filter((l) => won.has(l.id))
        .map((l) => ({
          id: l.id,
          title: l.title,
          auction_starts_at: l.auction_starts_at,
          auction_ends_at: l.auction_ends_at,
          seller_id: String(l.seller_id ?? ""),
          use_reserve_price: l.use_reserve_price === true,
          reserve_price_nok: l.reserve_price_nok,
          contact_threshold_percent: l.contact_threshold_percent,
        }));
    }
  }

  const allIds = [
    ...new Set([
      ...sellerRows.map((r) => r.id),
      ...bidderWinRows.map((r) => r.id),
    ]),
  ];
  if (allIds.length > 0) {
    const { data: allBids, error: allBidsErr } = await supabase
      .from("bids")
      .select("listing_id, amount_nok, created_at, bidder_id")
      .in("listing_id", allIds)
      .order("created_at", { ascending: true });

    if (allBidsErr) {
      throw new Error(`Could not load bids: ${allBidsErr.message}`);
    }

    for (const b of allBids ?? []) {
      const lid = b.listing_id;
      if (!lid) continue;
      const arr = bidsByListing.get(lid) ?? [];
      arr.push(b as BidRow);
      bidsByListing.set(lid, arr);
    }

    const { data: dealRows, error: dealsErr } = await supabase
      .from("listing_deals")
      .select(
        "listing_id, seller_decision, bidder_decision, buyer_received_card, seller_received_payment, completed_at",
      )
      .in("listing_id", allIds);

    if (dealsErr) {
      throw new Error(`Could not load deal rows: ${dealsErr.message}`);
    }

    for (const d of dealRows ?? []) {
      const lid = d.listing_id;
      if (!lid || typeof lid !== "string") continue;
      dealsByListing.set(lid, {
        listing_id: lid,
        seller_decision: String(d.seller_decision ?? ""),
        bidder_decision: String(d.bidder_decision ?? ""),
        buyer_received_card: isPgBoolTrue(d.buyer_received_card),
        seller_received_payment: isPgBoolTrue(d.seller_received_payment),
        completed_at: normalizeCompletedAtIso(d.completed_at),
      });
    }
  }

  {
    const { data: sellerDealRows, error: sellerDealsErr } = await supabase
      .from("listing_deals")
      .select(
        "listing_id, seller_id, bidder_id, seller_decision, bidder_decision, buyer_received_card, seller_received_payment, offer_price_nok",
      )
      .eq("seller_id", user.id);
    if (sellerDealsErr) {
      throw new Error(`Could not load fixed price deals: ${sellerDealsErr.message}`);
    }
    fixedSellerDeals = (sellerDealRows ?? []).map((row) => ({
      listing_id: String(row.listing_id ?? ""),
      seller_id: String(row.seller_id ?? ""),
      bidder_id: String(row.bidder_id ?? ""),
      seller_decision: String(row.seller_decision ?? "pending"),
      bidder_decision: String(row.bidder_decision ?? "pending"),
      buyer_received_card: isPgBoolTrue(row.buyer_received_card),
      seller_received_payment: isPgBoolTrue(row.seller_received_payment),
      offer_price_nok: row.offer_price_nok,
    }));

    const { data: buyerDealRows, error: buyerDealsErr } = await supabase
      .from("listing_deals")
      .select(
        "listing_id, seller_id, bidder_id, seller_decision, bidder_decision, buyer_received_card, seller_received_payment, offer_price_nok",
      )
      .eq("bidder_id", user.id);
    if (buyerDealsErr) {
      throw new Error(`Could not load fixed price deals: ${buyerDealsErr.message}`);
    }
    fixedBuyerDeals = (buyerDealRows ?? []).map((row) => ({
      listing_id: String(row.listing_id ?? ""),
      seller_id: String(row.seller_id ?? ""),
      bidder_id: String(row.bidder_id ?? ""),
      seller_decision: String(row.seller_decision ?? "pending"),
      bidder_decision: String(row.bidder_decision ?? "pending"),
      buyer_received_card: isPgBoolTrue(row.buyer_received_card),
      seller_received_payment: isPgBoolTrue(row.seller_received_payment),
      offer_price_nok: row.offer_price_nok,
    }));
  }

  const sortByAuctionEndDesc = (
    a: { auction_ends_at: string | null },
    b: { auction_ends_at: string | null },
  ) => {
    const ta = a.auction_ends_at ? new Date(a.auction_ends_at).getTime() : 0;
    const tb = b.auction_ends_at ? new Date(b.auction_ends_at).getTime() : 0;
    return tb - ta;
  };

  const sellerRowsSorted = [...sellerRows].sort(sortByAuctionEndDesc);
  const bidderWinRowsSorted = [...bidderWinRows].sort(sortByAuctionEndDesc);

  const tabClass = (isActive: boolean) =>
    `inline-flex items-center border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? "border-zinc-900 text-zinc-900"
        : "border-transparent text-zinc-500 hover:text-zinc-800"
    }`;
  const typeTabClass = (isActive: boolean) =>
    `inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
      isActive
        ? "border-blue-600 bg-blue-600 text-white"
        : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
    }`;
  const buildMyAuctionsHref = (next: {
    tab?: "annonser" | "deals";
    type?: "auction" | "fixed_price";
  }) => {
    const params = new URLSearchParams();
    const resolvedTab = next.tab ?? activeTab;
    const resolvedType = next.type ?? activeType;
    if (resolvedTab === "deals") {
      params.set("tab", "deals");
    }
    params.set("type", resolvedType);
    if (searchQuery !== "") {
      params.set("q", searchQuery);
    }
    return `/my-auctions?${params.toString()}`;
  };

  const postAuctionOutcomeGroupOrder: PostAuctionOutcomeGroup[] = [
    "deal_venter",
    "deal_bekreftet",
    "no_deal",
    "deal_fullfort",
  ];

  const sellerRowVms = sellerRowsSorted.map((row) => {
    const bidRows = bidsByListing.get(row.id) ?? [];
    const { highestNok, leadingBidderId } = leadingBidForListing(bidRows);
    const hasBids = bidRows.length > 0;
    const contactUnlocked = qualifiesAuctionContactFromHighestBid({
      useReservePrice: row.use_reserve_price,
      reservePriceNok: row.reserve_price_nok,
      contactThresholdPercent: row.contact_threshold_percent,
      highestBid: highestNok,
      hasBids,
    });
    const deal = dealsByListing.get(row.id);
    const group = postAuctionOutcomeGroup(deal, hasBids, contactUnlocked);
    return { row, highestNok, group, leadingBidderId, deal };
  });

  const bidderMineDealsRowVms = bidderWinRowsSorted.map((row) => {
    const bidRows = bidsByListing.get(row.id) ?? [];
    const { highestNok } = leadingBidForListing(bidRows);
    const hasBids = bidRows.length > 0;
    const contactUnlocked = qualifiesAuctionContactFromHighestBid({
      useReservePrice: row.use_reserve_price,
      reservePriceNok: row.reserve_price_nok,
      contactThresholdPercent: row.contact_threshold_percent,
      highestBid: highestNok,
      hasBids,
    });
    const deal = dealsByListing.get(row.id);
    const group = postAuctionOutcomeGroup(deal, hasBids, contactUnlocked);
    return { row, highestNok, group, deal };
  });

  const titleMatchesSearch = (title: string | null | undefined): boolean => {
    if (normalizedSearchQuery === "") return true;
    return String(title ?? "")
      .toLocaleLowerCase()
      .includes(normalizedSearchQuery);
  };

  const visibleSellerRowVms = sellerRowVms.filter((v) =>
    titleMatchesSearch(v.row.title),
  );
  const visibleBidderMineDealsRowVms = bidderMineDealsRowVms.filter((v) =>
    titleMatchesSearch(v.row.title),
  );

  const fixedPriceListingIds = [
    ...new Set([
      ...fixedSellerDeals.map((d) => d.listing_id),
      ...fixedBuyerDeals.map((d) => d.listing_id),
    ]),
  ].filter((id) => id !== "");
  const fixedPriceListingById = new Map<
    string,
    {
      id: string;
      title: string | null;
      price_nok: number | string | null;
      status: string | null;
      seller_id: string | null;
      type: string | null;
    }
  >();
  if (fixedPriceListingIds.length > 0) {
    console.log("[my-auctions fixed-price] listing ids from deals", {
      listingIds: fixedPriceListingIds,
    });
    const { data: fixedListingRows, error: fixedListingErr } = await supabase
      .from("listings")
      .select("id, title, price_nok, status, seller_id, type")
      .in("id", fixedPriceListingIds)
      .eq("type", "fixed_price");
    if (fixedListingErr) {
      throw new Error(`Could not load fixed price listings: ${fixedListingErr.message}`);
    }
    for (const row of fixedListingRows ?? []) {
      const id = String(row.id ?? "").trim();
      if (id === "") continue;
      fixedPriceListingById.set(id, {
        id,
        title: row.title,
        price_nok: row.price_nok,
        status: row.status,
        seller_id: row.seller_id,
        type: row.type,
      });
    }
    const returnedIds = [...fixedPriceListingById.keys()];
    const missingIds = fixedPriceListingIds.filter((id) => !fixedPriceListingById.has(id));
    console.log("[my-auctions fixed-price] listings lookup result", {
      returnedCount: returnedIds.length,
      returnedIds,
      missingCount: missingIds.length,
      missingIds,
    });
  }

  const fixedSellerVms = fixedSellerDeals
    .map((deal) => {
      if (deal.listing_id === "") return null;
      const listing = fixedPriceListingById.get(deal.listing_id);
      if (listing?.status === "deleted") return null;
      const offerRaw = deal.offer_price_nok;
      const offerNok =
        offerRaw != null && Number.isFinite(Number(offerRaw))
          ? Math.trunc(Number(offerRaw))
          : null;
      return {
        listingId: listing?.id ?? deal.listing_id,
        title: listing?.title ?? "Annonse ikke tilgjengelig",
        priceNok: listing?.price_nok ?? null,
        offerNok,
        sellerDecision: deal.seller_decision,
        bidderDecision: deal.bidder_decision,
        buyerReceivedCard: deal.buyer_received_card,
        sellerReceivedPayment: deal.seller_received_payment,
        counterpartId: deal.bidder_id,
        isListingMissing: listing == null,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v != null)
    .filter((v) => titleMatchesSearch(v.title));

  const fixedBuyerVms = fixedBuyerDeals
    .map((deal) => {
      if (deal.listing_id === "") return null;
      const listing = fixedPriceListingById.get(deal.listing_id);
      if (listing?.status === "deleted") return null;
      const offerRaw = deal.offer_price_nok;
      const offerNok =
        offerRaw != null && Number.isFinite(Number(offerRaw))
          ? Math.trunc(Number(offerRaw))
          : null;
      return {
        listingId: listing?.id ?? deal.listing_id,
        title: listing?.title ?? "Annonse ikke tilgjengelig",
        priceNok: listing?.price_nok ?? null,
        offerNok,
        sellerDecision: deal.seller_decision,
        bidderDecision: deal.bidder_decision,
        buyerReceivedCard: deal.buyer_received_card,
        sellerReceivedPayment: deal.seller_received_payment,
        counterpartId: deal.seller_id,
        isListingMissing: listing == null,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v != null)
    .filter((v) => titleMatchesSearch(v.title));

  const fixedGroupOrder: DealStatusGroup[] = [
    "deal_venter",
    "deal_bekreftet",
    "no_deal",
    "deal_fullfort",
  ];
  const fixedSellerGrouped = fixedSellerVms.map((row) => {
    const group = resolveDealStatusGroup({
      sellerDecision: row.sellerDecision,
      bidderDecision: row.bidderDecision,
      buyerReceivedCard: row.buyerReceivedCard,
      sellerReceivedPayment: row.sellerReceivedPayment,
      isCompleted: row.buyerReceivedCard && row.sellerReceivedPayment,
    });
    return {
      ...row,
      heading: dealStatusGroupLabel(group),
      group,
    };
  });
  const fixedBuyerGrouped = fixedBuyerVms.map((row) => {
    const group = resolveDealStatusGroup({
      sellerDecision: row.sellerDecision,
      bidderDecision: row.bidderDecision,
      buyerReceivedCard: row.buyerReceivedCard,
      sellerReceivedPayment: row.sellerReceivedPayment,
      isCompleted: row.buyerReceivedCard && row.sellerReceivedPayment,
    });
    return {
      ...row,
      heading: dealStatusGroupLabel(group),
      group,
    };
  });

  const hasSellerRows = visibleSellerRowVms.length > 0;
  const hasBidderMineDealsRows = visibleBidderMineDealsRowVms.length > 0;
  const hasFixedSellerRows = fixedSellerGrouped.length > 0;
  const hasFixedBuyerRows = fixedBuyerGrouped.length > 0;

  const counterpartProfileIds = new Set<string>();
  for (const v of visibleSellerRowVms) {
    if (
      v.group !== "no_deal" &&
      v.leadingBidderId != null &&
      String(v.leadingBidderId).trim() !== ""
    ) {
      counterpartProfileIds.add(String(v.leadingBidderId).trim());
    }
  }
  for (const v of visibleBidderMineDealsRowVms) {
    const sid = v.row.seller_id;
    if (sid != null && String(sid).trim() !== "") {
      counterpartProfileIds.add(String(sid).trim());
    }
  }
  for (const v of fixedSellerGrouped) {
    const id = String(v.counterpartId ?? "").trim();
    if (id !== "") counterpartProfileIds.add(id);
  }
  for (const v of fixedBuyerGrouped) {
    const id = String(v.counterpartId ?? "").trim();
    if (id !== "") counterpartProfileIds.add(id);
  }

  const usernameByUserId = new Map<string, string>();
  if (counterpartProfileIds.size > 0) {
    const { data: counterpartProfiles, error: counterpartProfErr } =
      await supabase
        .from("profiles")
        .select("id, username")
        .in("id", [...counterpartProfileIds]);

    if (counterpartProfErr) {
      throw new Error(
        `Could not load counterpart profiles: ${counterpartProfErr.message}`,
      );
    }
    for (const p of counterpartProfiles ?? []) {
      const id = typeof p.id === "string" ? p.id.trim() : "";
      const u = typeof p.username === "string" ? p.username.trim() : "";
      if (id !== "" && u !== "") usernameByUserId.set(id, u);
    }
  }

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <div className="space-y-1">
          <h1 className={pageTitleClass}>Mine deals</h1>
          <p className="text-sm text-zinc-600">
            Del opp etter Mine salg og Mine kjøp, med auksjon og fastpris i hver.
          </p>
        </div>
      </header>

      <section className={pageBodyGapClass}>
        <div className="space-y-6">
          <nav
            className="flex flex-wrap gap-1 border-b border-zinc-200"
            aria-label="Mine salg og Mine kjøp"
          >
            <Link
              href={buildMyAuctionsHref({ tab: "annonser" })}
              className={tabClass(activeTab === "annonser")}
              aria-current={activeTab === "annonser" ? "page" : undefined}
            >
              Mine salg
            </Link>
            <Link
              href={buildMyAuctionsHref({ tab: "deals" })}
              className={tabClass(activeTab === "deals")}
              aria-current={activeTab === "deals" ? "page" : undefined}
            >
              Mine kjøp
            </Link>
          </nav>

          <nav className="flex flex-wrap gap-2" aria-label="Type">
            <Link
              href={buildMyAuctionsHref({ type: "auction" })}
              className={typeTabClass(activeType === "auction")}
              aria-current={activeType === "auction" ? "page" : undefined}
            >
              Auksjoner
            </Link>
            <Link
              href={buildMyAuctionsHref({ type: "fixed_price" })}
              className={typeTabClass(activeType === "fixed_price")}
              aria-current={activeType === "fixed_price" ? "page" : undefined}
            >
              Fastpris
            </Link>
          </nav>

          <form method="get" className="space-y-2">
            <label
              htmlFor="my-auctions-search"
              className="text-xs font-semibold uppercase tracking-wide text-zinc-500"
            >
              Søk
            </label>
            <input
              id="my-auctions-search"
              name="q"
              type="search"
              defaultValue={searchQuery ?? ""}
              placeholder="Søk etter annonse"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
            {activeTab === "deals" ? (
              <input type="hidden" name="tab" value="deals" />
            ) : null}
            <input type="hidden" name="type" value={activeType} />
          </form>

          {activeTab === "annonser" ? (
            <>
              {activeType === "auction" ? (
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold text-zinc-900">
                    Auksjoner
                  </h2>
                  {!hasSellerRows ? (
                    <p className="text-sm text-zinc-600">
                      Ingen avsluttede auksjoner som selger.
                    </p>
                  ) : (
                    <div className="space-y-8">
                      {postAuctionOutcomeGroupOrder.map((groupKey) => {
                        const items = visibleSellerRowVms.filter(
                          (v) => v.group === groupKey,
                        );
                        return (
                          <div key={groupKey}>
                            <h3 className="text-sm font-semibold text-zinc-900">
                              {dealStatusGroupLabel(groupKey)}
                            </h3>
                            {items.length === 0 ? (
                              <p className="mt-2 text-sm text-zinc-600">
                                Ingen auksjoner i denne gruppen.
                              </p>
                            ) : (
                              <ul className="mt-2 divide-y divide-zinc-200 rounded-md border border-zinc-200">
                                {items.map(
                                  ({
                                    row,
                                    highestNok,
                                    group,
                                    leadingBidderId,
                                    deal,
                                  }) => {
                                    const bidderUn =
                                      group !== "no_deal" && leadingBidderId
                                        ? usernameByUserId.get(
                                            String(leadingBidderId).trim(),
                                          ) ?? null
                                        : null;
                                    const handlingHint = dealCardHandlingHint(
                                      "seller",
                                      deal,
                                      group,
                                    );
                                    return (
                                      <li
                                        key={row.id}
                                        className="flex flex-col gap-3 px-3 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                                      >
                                        <div className="space-y-1">
                                          <p className="font-medium text-zinc-900">
                                            {row.title?.trim() || "—"}
                                          </p>
                                          <p className="text-zinc-600">
                                            Høyeste bud:{" "}
                                            <span className="tabular-nums font-medium text-zinc-800">
                                              {highestNok > 0 ? highestNok : 0}
                                            </span>{" "}
                                            NOK
                                          </p>
                                          <p className="inline-flex w-fit rounded-full border border-zinc-300 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                                            {dealStatusGroupLabel(group)}
                                          </p>
                                          <p className="text-xs text-zinc-600">{handlingHint}</p>
                                          {bidderUn ? (
                                            <p className="text-xs text-zinc-600">
                                              Budgiver:{" "}
                                              <Link
                                                href={`/u/${encodeURIComponent(bidderUn)}`}
                                                className="font-medium text-zinc-800 underline-offset-2 hover:underline"
                                              >
                                                {bidderUn}
                                              </Link>
                                            </p>
                                          ) : null}
                                        </div>
                                        <Link
                                          href={`/my-auctions/${row.id}`}
                                          className="inline-flex w-fit shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                                        >
                                          Gå til deal
                                        </Link>
                                      </li>
                                    );
                                  },
                                )}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold text-zinc-900">
                    Fastpris
                  </h2>
                  {!hasFixedSellerRows ? (
                    <p className="text-sm text-zinc-600">
                      Ingen fastprisforespørsler som selger.
                    </p>
                  ) : (
                    <div className="space-y-8">
                      {fixedGroupOrder.map((groupKey) => {
                        const items = fixedSellerGrouped.filter(
                          (v) => v.group === groupKey,
                        );
                        return (
                          <div key={groupKey}>
                            <h3 className="text-sm font-semibold text-zinc-900">
                              {dealStatusGroupLabel(groupKey)}
                            </h3>
                            {items.length === 0 ? (
                              <p className="mt-2 text-sm text-zinc-600">
                                Ingen fastprisdeals i denne gruppen.
                              </p>
                            ) : (
                              <ul className="mt-2 divide-y divide-zinc-200 rounded-md border border-zinc-200">
                                {items.map((row) => {
                                  const counterpart =
                                    usernameByUserId.get(String(row.counterpartId).trim()) ??
                                    null;
                                  const counterpartIdRaw = String(
                                    row.counterpartId ?? "",
                                  ).trim();
                                  const buyerQs =
                                    counterpartIdRaw !== ""
                                      ? `?buyer=${encodeURIComponent(counterpartIdRaw)}`
                                      : "";
                                  return (
                                    <li
                                      key={`${row.listingId}-${counterpartIdRaw}`}
                                      className="flex flex-col gap-3 px-3 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                                    >
                                      <div className="space-y-1">
                                        <p className="font-medium text-zinc-900">
                                          {row.title}
                                        </p>
                                        {row.offerNok != null ? (
                                          <p className="text-zinc-600">
                                            Bud:{" "}
                                            <span className="tabular-nums font-medium text-zinc-800">
                                              {row.offerNok}
                                            </span>{" "}
                                            NOK
                                          </p>
                                        ) : row.isListingMissing ? (
                                          <p className="text-zinc-600">Annonse ikke tilgjengelig</p>
                                        ) : (
                                          <p className="text-zinc-600">
                                            Pris:{" "}
                                            <span className="tabular-nums font-medium text-zinc-800">
                                              {row.priceNok != null ? row.priceNok : "Pris mangler"}
                                            </span>{" "}
                                            NOK
                                          </p>
                                        )}
                                        <p className="inline-flex w-fit rounded-full border border-zinc-300 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                                          {row.heading}
                                        </p>
                                        <p className="text-xs text-zinc-600">
                                          {fixedDealHandlingHint("seller", row)}
                                        </p>
                                        {counterpart ? (
                                          <p className="text-xs text-zinc-600">
                                            Kjøper:{" "}
                                            <Link
                                              href={`/u/${encodeURIComponent(counterpart)}`}
                                              className="font-medium text-zinc-800 underline-offset-2 hover:underline"
                                            >
                                              {counterpart}
                                            </Link>
                                          </p>
                                        ) : null}
                                      </div>
                                      <Link
                                        href={`/my-auctions/${row.listingId}${buyerQs}`}
                                        className="inline-flex w-fit shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                                      >
                                        Gå til deal
                                      </Link>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {activeType === "auction" ? (
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold text-zinc-900">
                    Auksjoner
                  </h2>
                  {!hasBidderMineDealsRows ? (
                    <p className="text-sm text-zinc-600">
                      Ingen avsluttede auksjoner der du er høyeste budgiver.
                    </p>
                  ) : (
                    <div className="space-y-8">
                      {postAuctionOutcomeGroupOrder.map((groupKey) => {
                        const items = visibleBidderMineDealsRowVms.filter(
                          (v) => v.group === groupKey,
                        );
                        return (
                          <div key={groupKey}>
                            <h3 className="text-sm font-semibold text-zinc-900">
                              {dealStatusGroupLabel(groupKey)}
                            </h3>
                            {items.length === 0 ? (
                              <p className="mt-2 text-sm text-zinc-600">
                                Ingen auksjoner i denne gruppen.
                              </p>
                            ) : (
                              <ul className="mt-2 divide-y divide-zinc-200 rounded-md border border-zinc-200">
                                {items.map(
                                  ({ row, highestNok, group, deal }) => {
                                    const sellerUn =
                                      usernameByUserId.get(
                                        String(row.seller_id).trim(),
                                      ) ?? null;
                                    const handlingHint = dealCardHandlingHint(
                                      "bidder",
                                      deal,
                                      group,
                                    );
                                    return (
                                      <li
                                        key={row.id}
                                        className="flex flex-col gap-3 px-3 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                                      >
                                        <div className="space-y-1">
                                          <p className="font-medium text-zinc-900">
                                            {row.title?.trim() || "—"}
                                          </p>
                                          <p className="text-zinc-600">
                                            Auksjon{" "}
                                            <span className="mx-2 text-zinc-400">·</span>
                                            Høyeste bud:{" "}
                                            <span className="tabular-nums font-medium text-zinc-800">
                                              {highestNok > 0 ? highestNok : 0}
                                            </span>{" "}
                                            NOK
                                          </p>
                                          <p className="inline-flex w-fit rounded-full border border-zinc-300 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                                            {dealStatusGroupLabel(group)}
                                          </p>
                                          <p className="text-xs text-zinc-600">{handlingHint}</p>
                                          {sellerUn ? (
                                            <p className="text-xs text-zinc-600">
                                              Selger:{" "}
                                              <Link
                                                href={`/u/${encodeURIComponent(sellerUn)}`}
                                                className="font-medium text-zinc-800 underline-offset-2 hover:underline"
                                              >
                                                {sellerUn}
                                              </Link>
                                            </p>
                                          ) : null}
                                        </div>
                                        <Link
                                          href={`/my-auctions/${row.id}`}
                                          className="inline-flex w-fit shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                                        >
                                          Gå til deal
                                        </Link>
                                      </li>
                                    );
                                  },
                                )}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold text-zinc-900">
                    Fastpris
                  </h2>
                  {!hasFixedBuyerRows ? (
                    <p className="text-sm text-zinc-600">
                      Ingen fastprisforespørsler som kjøper.
                    </p>
                  ) : (
                    <div className="space-y-8">
                      {fixedGroupOrder.map((groupKey) => {
                        const items = fixedBuyerGrouped.filter(
                          (v) => v.group === groupKey,
                        );
                        return (
                          <div key={groupKey}>
                            <h3 className="text-sm font-semibold text-zinc-900">
                              {dealStatusGroupLabel(groupKey)}
                            </h3>
                            {items.length === 0 ? (
                              <p className="mt-2 text-sm text-zinc-600">
                                Ingen fastprisdeals i denne gruppen.
                              </p>
                            ) : (
                              <ul className="mt-2 divide-y divide-zinc-200 rounded-md border border-zinc-200">
                                {items.map((row) => {
                                  const counterpart =
                                    usernameByUserId.get(String(row.counterpartId).trim()) ??
                                    null;
                                  return (
                                    <li
                                      key={row.listingId}
                                      className="flex flex-col gap-3 px-3 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                                    >
                                      <div className="space-y-1">
                                        <p className="font-medium text-zinc-900">
                                          {row.title}
                                        </p>
                                        {row.offerNok != null ? (
                                          <p className="text-zinc-600">
                                            Bud:{" "}
                                            <span className="tabular-nums font-medium text-zinc-800">
                                              {row.offerNok}
                                            </span>{" "}
                                            NOK
                                          </p>
                                        ) : row.isListingMissing ? (
                                          <p className="text-zinc-600">Annonse ikke tilgjengelig</p>
                                        ) : (
                                          <p className="text-zinc-600">
                                            Pris:{" "}
                                            <span className="tabular-nums font-medium text-zinc-800">
                                              {row.priceNok != null ? row.priceNok : "Pris mangler"}
                                            </span>{" "}
                                            NOK
                                          </p>
                                        )}
                                        <p className="inline-flex w-fit rounded-full border border-zinc-300 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                                          {row.heading}
                                        </p>
                                        <p className="text-xs text-zinc-600">
                                          {fixedDealHandlingHint("buyer", row)}
                                        </p>
                                        {counterpart ? (
                                          <p className="text-xs text-zinc-600">
                                            Selger:{" "}
                                            <Link
                                              href={`/u/${encodeURIComponent(counterpart)}`}
                                              className="font-medium text-zinc-800 underline-offset-2 hover:underline"
                                            >
                                              {counterpart}
                                            </Link>
                                          </p>
                                        ) : null}
                                      </div>
                                      <Link
                                        href={`/my-auctions/${row.listingId}`}
                                        className="inline-flex w-fit shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                                      >
                                        Gå til deal
                                      </Link>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
