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
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ tab?: string | string[]; listing?: string | string[] }>;
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

function isPgBoolTrue(value: unknown): boolean {
  return value === true;
}

function normalizeCompletedAtIso(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (s === "" || s.toLowerCase() === "null") return null;
  return s;
}

/** Post-auction deal status for list display only (Norwegian). */
function myAuctionsStatusLabel(
  deal: DealRowLite | null | undefined,
  userId: string,
  listingSellerId: string,
  leadingBidderId: string | null,
): string {
  if (!deal) {
    return "Avsluttet";
  }
  const s = deal.seller_decision;
  const b = deal.bidder_decision;
  if (s === "no_deal" || b === "no_deal") {
    return "Ingen deal";
  }
  if (s === "deal" && b === "deal") {
    if (deal.buyer_received_card === true) {
      return "Fullført";
    }
    if (userId === listingSellerId) {
      return "Deal bekreftet – Mottaker venter på kort";
    }
    if (leadingBidderId != null && userId === leadingBidderId) {
      return "Deal bekreftet – Du venter på ditt kort";
    }
    return "Deal bekreftet";
  }
  if (s === "pending" && b === "pending") {
    return "Deal venter";
  }
  if (
    (s === "deal" && b === "pending") ||
    (s === "pending" && b === "deal")
  ) {
    return "Deal venter";
  }
  return "Deal venter";
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

function contactUnlockedAfterAuctionFromBids(
  useReservePrice: boolean,
  reserveNok: number | string | null,
  thresholdPct: number | string | null,
  highestBidNok: number,
  hasBids: boolean,
): boolean {
  if (!hasBids) return false;
  if (!useReservePrice) return true;
  const reserve =
    reserveNok != null && Number.isFinite(Number(reserveNok))
      ? Number(reserveNok)
      : Number.NaN;
  const pct =
    thresholdPct != null && Number.isFinite(Number(thresholdPct))
      ? Number(thresholdPct)
      : Number.NaN;
  if (!Number.isFinite(reserve) || !Number.isFinite(pct)) return false;
  const contactOpensAtNok = Math.ceil((reserve * pct) / 100);
  return highestBidNok >= contactOpensAtNok;
}

function sellerMineAnnonserStatusLabel(
  deal: DealRowLite | null | undefined,
  hasBids: boolean,
  contactUnlocked: boolean,
  userId: string,
  listingSellerId: string,
  leadingBidderId: string | null,
): string {
  if (!hasBids) return "Ingen bud";
  if (!contactUnlocked) return "Krav ikke møtt";
  if (!deal) return "Deal venter";
  return myAuctionsStatusLabel(
    deal,
    userId,
    listingSellerId,
    leadingBidderId,
  );
}

type PostAuctionOutcomeGroup =
  | "ikke_resultat"
  | "deal_venter"
  | "deal_bekreftet"
  | "deal_fullfort";

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
function postAuctionOutcomeGroup(
  deal: DealRowLite | null | undefined,
  hasBids: boolean,
  contactUnlocked: boolean,
): PostAuctionOutcomeGroup {
  if (!hasBids) return "ikke_resultat";
  if (!contactUnlocked) return "ikke_resultat";
  if (!deal) return "deal_venter";
  const s = deal.seller_decision;
  const b = deal.bidder_decision;
  if (s === "no_deal" || b === "no_deal") {
    return "ikke_resultat";
  }
  if (isSellerDealFullyCompleted(deal)) {
    return "deal_fullfort";
  }
  if (s === "deal" && b === "deal") {
    return "deal_bekreftet";
  }
  return "deal_venter";
}

function bidderMineDealsStatusLabel(
  deal: DealRowLite | null | undefined,
  hasBids: boolean,
  contactUnlocked: boolean,
  userId: string,
  listingSellerId: string,
  leadingBidderId: string | null,
): string {
  if (!hasBids) return "—";
  if (!contactUnlocked) return "Krav ikke møtt";
  if (!deal) return "Deal venter";
  return myAuctionsStatusLabel(
    deal,
    userId,
    listingSellerId,
    leadingBidderId,
  );
}

export default async function MyAuctionsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
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

  const listingParam = sp.listing;
  const listingKind: "auction" | "fixed_price" =
    typeof listingParam === "string" && listingParam === "fixed_price"
      ? "fixed_price"
      : "auction";

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
  const bidsByListing = new Map<string, BidRow[]>();
  const dealsByListing = new Map<string, DealRowLite>();

  if (listingKind === "auction") {
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
        for (const lid of candidateIds) {
          const { leadingBidderId } = leadingBidForListing(
            byListing.get(lid) ?? [],
          );
          if (leadingBidderId === user.id) {
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

  const hasSellerRows = sellerRowsSorted.length > 0;
  const hasBidderMineDealsRows = bidderWinRowsSorted.length > 0;

  const tabClass = (isActive: boolean) =>
    `inline-flex items-center border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
        : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
    }`;

  const postAuctionOutcomeGroupOrder: PostAuctionOutcomeGroup[] = [
    "deal_venter",
    "deal_bekreftet",
    "deal_fullfort",
    "ikke_resultat",
  ];

  const postAuctionOutcomeGroupTitle: Record<PostAuctionOutcomeGroup, string> =
    {
      ikke_resultat: "Ikke resultat",
      deal_venter: "Deal venter",
      deal_bekreftet: "Deal bekreftet",
      deal_fullfort: "Deal fullført",
    };

  const sellerRowVms = sellerRowsSorted.map((row) => {
    const bidRows = bidsByListing.get(row.id) ?? [];
    const { highestNok, leadingBidderId } = leadingBidForListing(bidRows);
    const hasBids = bidRows.length > 0;
    const contactUnlocked = contactUnlockedAfterAuctionFromBids(
      row.use_reserve_price,
      row.reserve_price_nok,
      row.contact_threshold_percent,
      highestNok,
      hasBids,
    );
    const deal = dealsByListing.get(row.id);
    const group = postAuctionOutcomeGroup(deal, hasBids, contactUnlocked);
    const statusLabel = sellerMineAnnonserStatusLabel(
      deal,
      hasBids,
      contactUnlocked,
      user.id,
      row.seller_id,
      leadingBidderId,
    );
    return { row, highestNok, statusLabel, group, leadingBidderId };
  });

  const bidderMineDealsRowVms = bidderWinRowsSorted.map((row) => {
    const bidRows = bidsByListing.get(row.id) ?? [];
    const { highestNok, leadingBidderId } = leadingBidForListing(bidRows);
    const hasBids = bidRows.length > 0;
    const contactUnlocked = contactUnlockedAfterAuctionFromBids(
      row.use_reserve_price,
      row.reserve_price_nok,
      row.contact_threshold_percent,
      highestNok,
      hasBids,
    );
    const deal = dealsByListing.get(row.id);
    const group = postAuctionOutcomeGroup(deal, hasBids, contactUnlocked);
    const statusLabel = bidderMineDealsStatusLabel(
      deal,
      hasBids,
      contactUnlocked,
      user.id,
      row.seller_id,
      leadingBidderId,
    );
    return { row, highestNok, statusLabel, group };
  });

  const counterpartProfileIds = new Set<string>();
  for (const v of sellerRowVms) {
    if (
      v.group !== "ikke_resultat" &&
      v.leadingBidderId != null &&
      String(v.leadingBidderId).trim() !== ""
    ) {
      counterpartProfileIds.add(String(v.leadingBidderId).trim());
    }
  }
  for (const v of bidderMineDealsRowVms) {
    const sid = v.row.seller_id;
    if (sid != null && String(sid).trim() !== "") {
      counterpartProfileIds.add(String(sid).trim());
    }
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

  const auctionListingHref =
    activeTab === "deals" ? "/my-auctions?tab=deals" : "/my-auctions";

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <div className="space-y-1">
          <h1 className={pageTitleClass}>Mine auksjoner</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {listingKind === "auction"
              ? "Kun avsluttede auksjoner (ikke planlagte eller pågående)."
              : "Fastpris etter salg."}
          </p>
        </div>
        <nav
          className="flex flex-wrap gap-1 border-b border-zinc-200 pb-0.5 dark:border-zinc-700"
          aria-label="Annonsetype"
        >
          <Link
            href={auctionListingHref}
            className={tabClass(listingKind === "auction")}
            aria-current={listingKind === "auction" ? "page" : undefined}
          >
            Auksjon
          </Link>
          <Link
            href="/my-auctions?listing=fixed_price"
            className={tabClass(listingKind === "fixed_price")}
            aria-current={
              listingKind === "fixed_price" ? "page" : undefined
            }
          >
            Fastpris
          </Link>
        </nav>
        <SignedInNavLinks />
      </header>

      <section className={pageBodyGapClass}>
        {listingKind === "fixed_price" ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Kommer snart.
          </p>
        ) : (
          <div className="space-y-6">
            <nav
              className="flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-700"
              aria-label="Mine salg og Mine kjøp"
            >
                <Link
                  href="/my-auctions"
                  className={tabClass(activeTab === "annonser")}
                  aria-current={activeTab === "annonser" ? "page" : undefined}
                >
                  Mine salg
                </Link>
                <Link
                  href="/my-auctions?tab=deals"
                  className={tabClass(activeTab === "deals")}
                  aria-current={activeTab === "deals" ? "page" : undefined}
                >
                  Mine kjøp
                </Link>
              </nav>

              {activeTab === "annonser" ? (
                !hasSellerRows ? (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Ingen avsluttede auksjoner som selger.
                  </p>
                ) : (
                  <div className="space-y-8">
                  {postAuctionOutcomeGroupOrder.map((groupKey) => {
                    const items = sellerRowVms.filter((v) => v.group === groupKey);
                    return (
                      <div key={groupKey}>
                        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {postAuctionOutcomeGroupTitle[groupKey]}
                        </h2>
                        {items.length === 0 ? (
                          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                            Ingen auksjoner i denne gruppen.
                          </p>
                        ) : (
                          <ul className="mt-2 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
                            {items.map(
                              ({
                                row,
                                highestNok,
                                statusLabel,
                                group,
                                leadingBidderId,
                              }) => {
                                const bidderUn =
                                  group !== "ikke_resultat" && leadingBidderId
                                    ? usernameByUserId.get(
                                        String(leadingBidderId).trim(),
                                      ) ?? null
                                    : null;
                                return (
                                  <li
                                    key={row.id}
                                    className="flex flex-col gap-3 px-3 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                                  >
                                    <div className="space-y-1">
                                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                                        {row.title?.trim() || "—"}
                                      </p>
                                      <p className="text-zinc-600 dark:text-zinc-400">
                                        Høyeste bud:{" "}
                                        <span className="tabular-nums font-medium text-zinc-800 dark:text-zinc-200">
                                          {highestNok > 0 ? highestNok : 0}
                                        </span>{" "}
                                        NOK
                                      </p>
                                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                                        {statusLabel}
                                      </p>
                                      {bidderUn ? (
                                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                          Budgiver:{" "}
                                          <Link
                                            href={`/u/${encodeURIComponent(bidderUn)}`}
                                            className="font-medium text-zinc-800 underline-offset-2 hover:underline dark:text-zinc-200"
                                          >
                                            {bidderUn}
                                          </Link>
                                        </p>
                                      ) : null}
                                    </div>
                                    <Link
                                      href={`/my-auctions/${row.id}`}
                                      className="inline-flex w-fit shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
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
                )
              ) : !hasBidderMineDealsRows ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Ingen avsluttede auksjoner der du er høyeste budgiver.
                </p>
              ) : (
                <div className="space-y-8">
                  {postAuctionOutcomeGroupOrder.map((groupKey) => {
                    const items = bidderMineDealsRowVms.filter(
                      (v) => v.group === groupKey,
                    );
                    return (
                      <div key={groupKey}>
                        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {postAuctionOutcomeGroupTitle[groupKey]}
                        </h2>
                        {items.length === 0 ? (
                          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                            Ingen auksjoner i denne gruppen.
                          </p>
                        ) : (
                          <ul className="mt-2 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
                            {items.map(({ row, highestNok, statusLabel }) => {
                              const sellerUn =
                                usernameByUserId.get(
                                  String(row.seller_id).trim(),
                                ) ?? null;
                              return (
                                <li
                                  key={row.id}
                                  className="flex flex-col gap-3 px-3 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="space-y-1">
                                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                                      {row.title?.trim() || "—"}
                                    </p>
                                    <p className="text-zinc-600 dark:text-zinc-400">
                                      Høyeste bud:{" "}
                                      <span className="tabular-nums font-medium text-zinc-800 dark:text-zinc-200">
                                        {highestNok > 0 ? highestNok : 0}
                                      </span>{" "}
                                      NOK
                                    </p>
                                    <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                                      {statusLabel}
                                    </p>
                                    {sellerUn ? (
                                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                        Selger:{" "}
                                        <Link
                                          href={`/u/${encodeURIComponent(sellerUn)}`}
                                          className="font-medium text-zinc-800 underline-offset-2 hover:underline dark:text-zinc-200"
                                        >
                                          {sellerUn}
                                        </Link>
                                      </p>
                                    ) : null}
                                  </div>
                                  <Link
                                    href={`/my-auctions/${row.id}`}
                                    className="inline-flex w-fit shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
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
      </section>
    </div>
  );
}
