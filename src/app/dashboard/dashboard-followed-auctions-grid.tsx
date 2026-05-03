"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  leadingBidderIdByListingId,
  type BidForLeadingRow,
} from "@/lib/auction-viewer-bid-status";
import {
  nextValidBidAmountNok,
  parsedMinBidIncrementNok,
} from "@/lib/auction-next-bid-nok";
import { formatAuctionTimeRemainingNo } from "@/lib/auction-time-remaining-no";
import { normalizeListingImageUrls } from "@/lib/listing-images";
import { ListingCategoryBadge } from "@/components/listing-category-badge";

import { DashboardCustomBidForm } from "./dashboard-custom-bid-form";
import { DashboardQuickBidForm } from "./dashboard-quick-bid-form";

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

/** Buyer-facing bid position; omitted on viewer's own listing (seller). */
function viewerAuctionStatusPill(
  sellerId: string | null,
  viewerId: string,
  userHasBidOnListing: boolean,
  leadingBidderId: string | null | undefined,
): { label: string; className: string } | null {
  if (sellerId != null && sellerId === viewerId) return null;
  if (!userHasBidOnListing) {
    return {
      label: "Du har ikke bydd",
      className:
        "border border-zinc-200 bg-zinc-50 text-zinc-600",
    };
  }
  if (leadingBidderId === viewerId) {
    return {
      label: "Du leder",
      className:
        "border border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }
  return {
    label: "Du er overbydd",
    className:
      "border border-amber-200 bg-amber-50 text-amber-900",
  };
}

export type DashboardAuctionFilter =
  | "alle"
  | "har_bydd"
  | "leder"
  | "ikke_bydd";

type DashboardFollowedAuctionsGridProps = {
  auctions: TrackedAuctionListingRow[];
  userId: string;
  /** Listing IDs where the current user has placed at least one bid */
  userBidListingIds: string[];
  /** Highest bid amount per listing id (from server maps) */
  highestNokByListingId: Record<string, number>;
  /** Bid rows for recomputing leading bidder consistent with server */
  bidRowsForListings: BidForLeadingRow[];
  sellerUsernameById: Record<string, string>;
  nowMs: number;
};

export function DashboardFollowedAuctionsGrid({
  auctions,
  userId,
  userBidListingIds,
  highestNokByListingId,
  bidRowsForListings,
  sellerUsernameById,
  nowMs,
}: DashboardFollowedAuctionsGridProps) {
  const [filter, setFilter] = useState<DashboardAuctionFilter>("alle");

  const userBidSet = useMemo(
    () => new Set(userBidListingIds),
    [userBidListingIds],
  );

  const leadingByListingId = useMemo(
    () => leadingBidderIdByListingId(bidRowsForListings),
    [bidRowsForListings],
  );

  const bidCountByListingId = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of bidRowsForListings) {
      const lid = r.listing_id;
      if (typeof lid === "string" && lid !== "") {
        m.set(lid, (m.get(lid) ?? 0) + 1);
      }
    }
    return m;
  }, [bidRowsForListings]);

  const filteredAuctions = useMemo(() => {
    if (filter === "alle") return auctions;
    if (filter === "har_bydd") {
      return auctions.filter((a) => userBidSet.has(a.id));
    }
    if (filter === "leder") {
      return auctions.filter((a) => leadingByListingId.get(a.id) === userId);
    }
    if (filter === "ikke_bydd") {
      return auctions.filter((a) => !userBidSet.has(a.id));
    }
    return auctions;
  }, [
    auctions,
    filter,
    userBidSet,
    leadingByListingId,
    userId,
  ]);

  function selectFilter(next: DashboardAuctionFilter) {
    setFilter(next);
  }

  const filterLabels: { id: DashboardAuctionFilter; label: string }[] = [
    { id: "alle", label: "Alle" },
    { id: "har_bydd", label: "Har bydd" },
    { id: "leder", label: "Leder" },
    { id: "ikke_bydd", label: "Ikke bydd" },
  ];

  return (
    <>
      <div
        className="mt-3 flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filtrer auksjoner"
      >
        {filterLabels.map(({ id, label }) => {
          const active = filter === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => selectFilter(id)}
              className={
                active
                  ? "rounded-full border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-sm text-white"
                  : "rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      {filteredAuctions.length === 0 && auctions.length > 0 ? (
        <p className="mt-4 text-sm text-zinc-600">
          Ingen auksjoner i denne visningen.
        </p>
      ) : null}
      {filteredAuctions.length > 0 ? (
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAuctions.map((row) => {
            const coverImage =
              normalizeListingImageUrls(row.image_urls)[0] ?? null;
            const state = auctionStateLabelNo(
              nowMs,
              row.auction_starts_at ?? null,
              row.auction_ends_at ?? null,
            );
            const endMs = row.auction_ends_at
              ? new Date(row.auction_ends_at).getTime()
              : Number.NaN;
            const timeLeft = Number.isFinite(endMs)
              ? formatAuctionTimeRemainingNo(endMs, nowMs)
              : null;
            const hasAnyBid = Object.prototype.hasOwnProperty.call(
              highestNokByListingId,
              row.id,
            );
            const high = hasAnyBid
              ? (highestNokByListingId[row.id] ?? 0)
              : 0;
            const quickAmount = nextValidBidAmountNok(
              hasAnyBid,
              high,
              row.price_nok,
              row.min_bid_increment_nok,
            );
            const incrementDisplay = parsedMinBidIncrementNok(
              row.min_bid_increment_nok,
            );
            const showQuickBid =
              quickAmount != null &&
              row.seller_id != null &&
              row.seller_id !== userId;
            const bidCount = bidCountByListingId.get(row.id) ?? 0;
            const viewerStatus = viewerAuctionStatusPill(
              row.seller_id,
              userId,
              userBidSet.has(row.id),
              leadingByListingId.get(row.id),
            );
            return (
              <li key={row.id} className="min-h-0 min-w-0">
                <div className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-sm sm:p-4">
                  {/* TOP INFO: 1–4 + image */}
                  <div className="flex gap-3">
                    {coverImage ? (
                      <div className="relative h-24 w-[6.5rem] shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 sm:h-28 sm:w-[7.25rem]">
                        <Image
                          src={coverImage}
                          alt=""
                          width={140}
                          height={112}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-24 w-[6.5rem] shrink-0 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-500 sm:h-28 sm:w-[7.25rem]">
                        Bilde
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-900">
                        {row.title?.trim() || "—"}
                      </p>
                      <div className="flex min-w-0 flex-nowrap items-center gap-2">
                        <ListingCategoryBadge category={row.category} />
                        <span className="inline-flex shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase leading-none tracking-wide text-emerald-800">
                          {state}
                        </span>
                      </div>
                      {row.seller_id ? (
                        <p className="truncate text-xs text-zinc-500">
                          {sellerUsernameById[row.seller_id] ?? "—"}
                        </p>
                      ) : null}
                      {timeLeft ? (
                        <p className="text-xs text-zinc-500">
                          <span className="font-medium text-zinc-600">
                            Tid igjen
                          </span>{" "}
                          <span className="tabular-nums">{timeLeft}</span>
                        </p>
                      ) : null}
                      {viewerStatus ? (
                        <span
                          className={`inline-flex w-fit max-w-full rounded-full px-2 py-0.5 text-[11px] font-medium leading-none ${viewerStatus.className}`}
                        >
                          {viewerStatus.label}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* BID SECTION: 6–11 (6–7 always; 8–11 when viewer can bid) */}
                  <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-xs text-zinc-500">HØYESTE BUD</p>
                        <p className="text-base font-semibold tabular-nums text-zinc-900">
                          {high} NOK
                        </p>
                      </div>
                      <div className="shrink-0 space-y-0.5 text-right">
                        <p className="text-xs text-zinc-500">ANTALL BUD</p>
                        <p className="text-base font-semibold tabular-nums text-zinc-900">
                          {bidCount}
                        </p>
                      </div>
                    </div>
                    {showQuickBid && quickAmount != null ? (
                      <>
                        {/* 8 */}
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                          <DashboardQuickBidForm
                            listingId={row.id}
                            amountNok={quickAmount}
                            className="sm:shrink-0"
                          />
                          {incrementDisplay != null ? (
                            <p className="text-xs tabular-nums text-zinc-500 sm:shrink-0">
                              Minste økning: {incrementDisplay} NOK
                            </p>
                          ) : null}
                        </div>
                        {/* 9–11 (helper inside custom form) */}
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-zinc-700">
                            Egendefinert bud
                          </p>
                          <DashboardCustomBidForm
                            listingId={row.id}
                            minNextBidNok={quickAmount}
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                  <Link
                    href={`/listings/${row.id}`}
                    className="mt-6 inline-flex w-full items-center justify-center py-1 text-sm font-normal text-blue-600 hover:underline"
                  >
                    Se hele annonsen
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </>
  );
}
