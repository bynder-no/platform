"use client";

import Image from "next/image";
import Link from "next/link";

import { HomeCardFavoriteButton } from "@/app/home-card-favorite-button";
import type { DiscoverGridItem } from "@/app/discover/discover-grid";
import { normalizeListingImageUrls } from "@/lib/listing-images";

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

type FavoritesGridProps = {
  items: DiscoverGridItem[];
};

export function FavoritesGrid({ items }: FavoritesGridProps) {
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {items.map((item) => {
        const coverImage = normalizeListingImageUrls(item.image_urls)[0] ?? null;

        return (
          <li
            key={item.id}
            className="ui-card overflow-hidden transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
          >
            <Link
              href={`/listings/${item.id}`}
              className="group relative block aspect-[4/5] w-full overflow-hidden bg-zinc-100"
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
                <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                  Ingen bilde
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-900/85 via-zinc-900/45 to-transparent p-2.5 text-white">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="inline-flex rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-zinc-800">
                    {typeLabel(item.type)}
                  </span>
                  <span className="text-[12px] font-semibold">{priceLabel(item)}</span>
                </div>
                <p className="line-clamp-2 text-xs font-semibold leading-snug">
                  {item.title?.trim() || "—"}
                </p>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-white/90">
                  {item.seller_name}
                </p>
              </div>
            </Link>
            <div className="flex items-center justify-between gap-2 px-2.5 py-2">
              <Link
                href={`/listings/${item.id}`}
                className="min-w-0 text-xs font-medium text-blue-600 hover:underline"
              >
                Se annonse
              </Link>
              <HomeCardFavoriteButton
                listingId={item.id}
                isFavorite
                returnTo="/favorites"
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
