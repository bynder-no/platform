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
import { viewerAuctionBidPositionLabel } from "@/lib/auction-viewer-bid-status";

export const dynamic = "force-dynamic";

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

function isFullyCompletedAuctionDeal(
  deal: DealRowLite | null | undefined,
): boolean {
  if (!deal) return false;
  return (
    deal.seller_decision === "deal" &&
    deal.bidder_decision === "deal" &&
    deal.buyer_received_card === true &&
    deal.seller_received_payment === true &&
    deal.completed_at != null
  );
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
    return "Venter på svar";
  }
  if (
    (s === "deal" && b === "pending") ||
    (s === "pending" && b === "deal")
  ) {
    return "Venter på svar";
  }
  return "Venter på svar";
}

export default async function MyAuctionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const nowIso = new Date().toISOString();

  const { data: sellerListings, error: sellerErr } = await supabase
    .from("listings")
    .select("id, title, auction_ends_at, seller_id")
    .eq("type", "auction")
    .not("auction_ends_at", "is", null)
    .lte("auction_ends_at", nowIso)
    .eq("seller_id", user.id);

  if (sellerErr) {
    throw new Error(`Could not load auctions: ${sellerErr.message}`);
  }

  const { data: myBidRows, error: myBidsErr } = await supabase
    .from("bids")
    .select("listing_id")
    .eq("bidder_id", user.id);

  if (myBidsErr) {
    throw new Error(`Could not load bids: ${myBidsErr.message}`);
  }

  const sellerIds = new Set((sellerListings ?? []).map((l) => l.id));
  const bidListingIds = [
    ...new Set(
      (myBidRows ?? [])
        .map((r) => r.listing_id)
        .filter((id): id is string => typeof id === "string" && id !== ""),
    ),
  ].filter((id) => !sellerIds.has(id));

  let bidderWinRows: {
    id: string;
    title: string | null;
    auction_ends_at: string | null;
    seller_id: string;
  }[] = [];

  if (bidListingIds.length > 0) {
    const { data: bidderCandidates, error: bidderListErr } = await supabase
      .from("listings")
      .select("id, title, auction_ends_at, seller_id")
      .eq("type", "auction")
      .not("auction_ends_at", "is", null)
      .lte("auction_ends_at", nowIso)
      .in("id", bidListingIds);

    if (bidderListErr) {
      throw new Error(`Could not load auctions: ${bidderListErr.message}`);
    }

    const candidateIds = (bidderCandidates ?? []).map((l) => l.id);
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
        const { leadingBidderId } = leadingBidForListing(byListing.get(lid) ?? []);
        if (leadingBidderId === user.id) {
          won.add(lid);
        }
      }

      bidderWinRows = (bidderCandidates ?? [])
        .filter((l) => won.has(l.id))
        .map((l) => ({
          ...l,
          seller_id: String(l.seller_id ?? ""),
        }));
    }
  }

  const merged = new Map<
    string,
    {
      id: string;
      title: string | null;
      auction_ends_at: string | null;
      seller_id: string;
    }
  >();
  for (const l of sellerListings ?? []) {
    merged.set(l.id, {
      ...l,
      seller_id: String(l.seller_id ?? ""),
    });
  }
  for (const l of bidderWinRows) {
    merged.set(l.id, l);
  }

  const allIds = [...merged.keys()];
  const bidsByListing = new Map<string, BidRow[]>();
  const dealsByListing = new Map<string, DealRowLite>();
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

  const rows = [...merged.values()].sort((a, b) => {
    const ta = a.auction_ends_at ? new Date(a.auction_ends_at).getTime() : 0;
    const tb = b.auction_ends_at ? new Date(b.auction_ends_at).getTime() : 0;
    return tb - ta;
  });

  const completedRows = rows.filter((row) =>
    isFullyCompletedAuctionDeal(dealsByListing.get(row.id)),
  );
  const ongoingRows = rows.filter(
    (row) => !isFullyCompletedAuctionDeal(dealsByListing.get(row.id)),
  );

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <h1 className={pageTitleClass}>Mine auksjoner</h1>
        <SignedInNavLinks />
      </header>

      <section className={pageBodyGapClass}>
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Ingen avsluttede auksjoner der du er selger eller høyeste budgiver.
          </p>
        ) : (
          <div className="space-y-8">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Pågående
              </h2>
              {ongoingRows.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Ingen pågående handler
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
                  {ongoingRows.map((row) => {
                    const bidRows = bidsByListing.get(row.id) ?? [];
                    const { highestNok, leadingBidderId } =
                      leadingBidForListing(bidRows);
                    const statusLabel = myAuctionsStatusLabel(
                      dealsByListing.get(row.id),
                      user.id,
                      row.seller_id,
                      leadingBidderId,
                    );
                    const bidPositionLabel =
                      row.seller_id !== user.id
                        ? viewerAuctionBidPositionLabel(
                            user.id,
                            bidRows.length > 0,
                            leadingBidderId,
                          )
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
                          {bidPositionLabel ? (
                            <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                              {bidPositionLabel}
                            </p>
                          ) : null}
                          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            {statusLabel}
                          </p>
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
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Fullførte
              </h2>
              {completedRows.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Ingen fullførte handler
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
                  {completedRows.map((row) => {
                    const bidRows = bidsByListing.get(row.id) ?? [];
                    const { highestNok, leadingBidderId } =
                      leadingBidForListing(bidRows);
                    const statusLabel = myAuctionsStatusLabel(
                      dealsByListing.get(row.id),
                      user.id,
                      row.seller_id,
                      leadingBidderId,
                    );
                    const bidPositionLabel =
                      row.seller_id !== user.id
                        ? viewerAuctionBidPositionLabel(
                            user.id,
                            bidRows.length > 0,
                            leadingBidderId,
                          )
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
                          {bidPositionLabel ? (
                            <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                              {bidPositionLabel}
                            </p>
                          ) : null}
                          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            {statusLabel}
                          </p>
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
          </div>
        )}
      </section>
    </div>
  );
}
