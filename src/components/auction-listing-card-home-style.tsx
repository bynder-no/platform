import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

import { ListingCategoryBadge } from "@/components/listing-category-badge";
import { normalizeListingImageUrls } from "@/lib/listing-images";
import { formatAuctionTimeRemainingNo } from "@/lib/auction-time-remaining-no";

/** Matches home listing auction cards (Nyeste auksjonsannonser). */
export const auctionListingCardShellClass =
  "group relative flex h-full w-full min-w-0 max-w-none flex-col gap-2.5 rounded-2xl border border-zinc-200 bg-white p-3 text-sm shadow-sm transition-all duration-300 ease-out cursor-pointer";

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

function homeCardSellerUsernameDisplay(
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

export type AuctionListingCardHomeStyleRow = {
  id: string;
  title: string | null;
  category: string | null;
  image_urls: unknown;
  auction_starts_at: string | null;
  auction_ends_at: string | null;
  seller_id: string | null;
};

export type AuctionListingCardHomeStyleProps = {
  row: AuctionListingCardHomeStyleRow;
  nowMs: number;
  sellerUsernameById: Map<string, string>;
  viewerUserId: string | null;
  liveNok: number;
  bidPositionLabel: string | null;
  favoriteSlot?: ReactNode;
};

export function AuctionListingCardHomeStyle({
  row,
  nowMs,
  sellerUsernameById,
  viewerUserId,
  liveNok,
  bidPositionLabel,
  favoriteSlot,
}: AuctionListingCardHomeStyleProps) {
  const coverImage = normalizeListingImageUrls(row.image_urls)[0] ?? null;
  const state = auctionStateLabelNo(
    nowMs,
    row.auction_starts_at ?? null,
    row.auction_ends_at ?? null,
  );
  const timeLeft = homeAuctionTimeRemainingLabel(
    state,
    row.auction_starts_at ?? null,
    row.auction_ends_at ?? null,
    nowMs,
  );
  const listingLabel = row.title?.trim()
    ? `Se annonse: ${row.title.trim()}`
    : "Se annonse";

  return (
    <div
      className={`${auctionListingCardShellClass} hover:-translate-y-1 hover:border-zinc-300 hover:shadow-md`}
    >
      <Link
        href={`/listings/${row.id}`}
        className="absolute inset-0 z-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
        aria-label={listingLabel}
      />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-2.5 pointer-events-none">
        {coverImage ? (
          <div className="mb-1.5 shrink-0 overflow-hidden rounded-xl border border-zinc-200">
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
          <div className="mb-1.5 flex h-44 w-full shrink-0 items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-500">
            Ingen bilde
          </div>
        )}
        <div className="flex min-h-0 flex-1 items-stretch gap-2.5">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5">
            <p className="line-clamp-2 overflow-hidden break-words font-semibold text-zinc-900 group-hover:underline">
              {row.title?.trim() || "—"}
            </p>
            <p className="text-xs text-zinc-500">
              {homeCardSellerUsernameDisplay(row.seller_id, sellerUsernameById)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex w-fit shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                {state}
              </span>
              <ListingCategoryBadge category={row.category} />
            </div>
            <div className="mt-auto flex flex-col gap-1 text-inherit">
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
          row.seller_id !== viewerUserId &&
          favoriteSlot ? (
            <div className="relative z-20 shrink-0 self-start pointer-events-auto">
              {favoriteSlot}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
