"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { normalizeListingImageUrls } from "@/lib/listing-images";

export type DiscoverGridItem = {
  id: string;
  title: string | null;
  type: string | null;
  price_nok: number | null;
  image_urls: unknown;
  seller_name: string;
  seller_username: string | null;
  highest_bid_nok: number | null;
};

type DiscoverGridProps = {
  allItems: DiscoverGridItem[];
  batchSize: number;
};

function typeLabel(type: string | null) {
  if (type === "auction") return "Auksjon";
  if (type === "fixed_price") return "Fastpris";
  return "Annonse";
}

function priceLabel(item: DiscoverGridItem) {
  if (item.type === "auction") {
    if (item.highest_bid_nok != null) return `${item.highest_bid_nok} NOK`;
    if (item.price_nok != null) return `${item.price_nok} NOK`;
    return "Pris mangler";
  }
  if (item.price_nok != null) return `${item.price_nok} NOK`;
  return "Pris mangler";
}

export function DiscoverGrid({ allItems, batchSize }: DiscoverGridProps) {
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const items = useMemo(
    () => allItems.slice(0, Math.max(0, visibleCount)),
    [allItems, visibleCount],
  );
  const hasMore = visibleCount < allItems.length;

  function onLoadMore() {
    setVisibleCount((prev) => Math.min(prev + batchSize, allItems.length));
  }

  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {items.map((item) => {
          const sellerHref =
            item.seller_username != null
              ? `/u/${encodeURIComponent(item.seller_username)}`
              : null;
          const coverImage = normalizeListingImageUrls(item.image_urls)[0] ?? null;

          return (
            <li
              key={item.id}
              className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <Link
                href={`/listings/${item.id}`}
                className="group relative block aspect-[4/5] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800"
              >
                {coverImage ? (
                  <Image
                    src={coverImage}
                    alt={item.title?.trim() || "Annonsebilde"}
                    width={800}
                    height={1000}
                    unoptimized
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500 dark:text-zinc-400">
                    Ingen bilde
                  </div>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent p-2.5 text-white">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="inline-flex rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-medium">
                      {typeLabel(item.type)}
                    </span>
                    <span className="text-[11px] font-semibold">{priceLabel(item)}</span>
                  </div>
                  <p className="line-clamp-1 text-xs font-semibold">
                    {item.title?.trim() || "—"}
                  </p>
                  <p className="line-clamp-1 text-[11px] text-white/90">
                    {item.seller_name}
                  </p>
                </div>
              </Link>
              {sellerHref ? (
                <div className="px-2.5 py-2">
                  <Link
                    href={sellerHref}
                    className="text-xs text-zinc-600 hover:underline dark:text-zinc-400"
                  >
                    Se profil
                  </Link>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col items-center gap-2">
        {hasMore ? (
          <button
            type="button"
            onClick={onLoadMore}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Last flere
          </button>
        ) : (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Du har sett alle annonser.
          </p>
        )}
      </div>
    </div>
  );
}
