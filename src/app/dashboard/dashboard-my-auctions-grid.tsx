import Image from "next/image";
import Link from "next/link";

import { auctionTimeRemainingLabelFromState } from "@/lib/auction-time-remaining-no";
import { normalizeListingImageUrls } from "@/lib/listing-images";
import { ListingCategoryBadge } from "@/components/listing-category-badge";

type OwnedAuctionListingRow = {
  id: string;
  title: string | null;
  type: string | null;
  category: string | null;
  image_urls: unknown;
  auction_starts_at: string | null;
  auction_ends_at: string | null;
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

function stateBadgeClass(state: "Planlagt" | "Live" | "Avsluttet"): string {
  if (state === "Planlagt") {
    return "border border-sky-200 bg-sky-100 text-sky-900";
  }
  if (state === "Live") {
    return "border border-emerald-200 bg-emerald-100 text-emerald-800";
  }
  return "border border-zinc-200 bg-zinc-100 text-zinc-700";
}

export type DashboardMyAuctionsGridProps = {
  auctions: OwnedAuctionListingRow[];
  highestNokByListingId: Record<string, number>;
  bidCountByListingId: Record<string, number>;
  nowMs: number;
};

export function DashboardMyAuctionsGrid({
  auctions,
  highestNokByListingId,
  bidCountByListingId,
  nowMs,
}: DashboardMyAuctionsGridProps) {
  if (auctions.length === 0) {
    return null;
  }

  return (
    <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {auctions.map((row) => {
        const coverImage =
          normalizeListingImageUrls(row.image_urls)[0] ?? null;
        const state = auctionStateLabelNo(
          nowMs,
          row.auction_starts_at ?? null,
          row.auction_ends_at ?? null,
        );
        const timeLabel = auctionTimeRemainingLabelFromState(
          state,
          row.auction_starts_at ?? null,
          row.auction_ends_at ?? null,
          nowMs,
        );
        const hasAnyBid = Object.prototype.hasOwnProperty.call(
          highestNokByListingId,
          row.id,
        );
        const high = hasAnyBid ? (highestNokByListingId[row.id] ?? 0) : 0;
        const bidCount = bidCountByListingId[row.id] ?? 0;

        return (
          <li key={row.id} className="min-h-0 min-w-0">
            <div className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-sm sm:p-4">
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
                    <span
                      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase leading-none tracking-wide ${stateBadgeClass(state)}`}
                    >
                      {state}
                    </span>
                  </div>
                  {timeLabel ? (
                    <p className="text-xs text-zinc-500">
                      <span className="font-medium text-zinc-600">
                        {state === "Planlagt" ? "Tid til start" : "Tid igjen"}
                      </span>{" "}
                      <span className="tabular-nums">{timeLabel}</span>
                    </p>
                  ) : null}
                </div>
              </div>

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
              </div>

              <Link
                href={`/listings/${row.id}`}
                className="mt-6 inline-flex w-full items-center justify-center py-1 text-sm font-normal text-blue-600 hover:underline"
              >
                Se annonse
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
