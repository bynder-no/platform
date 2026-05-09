import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { normalizeListingImageUrls } from "@/lib/listing-images";

export type ProfileShopListingCardProps = {
  listingId: string;
  title: string | null;
  /** Full price line for overlay (e.g. Fastpris: 99 NOK). */
  priceLabel: string;
  image_urls: unknown;
  /** Shown in overlay badge; default Fastpris for shop grids. */
  typeLabel?: string;
  /** Primary links/actions (e.g. Se annonse, Gi bud). */
  footerLeft: ReactNode;
  /** Favorite control — pinned to the far right when set. */
  footerRight?: ReactNode;
};

/**
 * Discover/Following-style card for profile shop listings: tall image, gradient overlay, compact footer.
 */
export function ProfileShopListingCard({
  listingId,
  title,
  priceLabel,
  image_urls,
  typeLabel = "Fastpris",
  footerLeft,
  footerRight,
}: ProfileShopListingCardProps) {
  const coverImage = normalizeListingImageUrls(image_urls)[0] ?? null;
  const listingHref = `/listings/${listingId}`;
  const titleText = title?.trim() || "—";

  return (
    <li className="ui-card overflow-hidden transition duration-200 hover:-translate-y-0.5">
      <Link
        href={listingHref}
        className="group relative block aspect-[4/5] w-full overflow-hidden bg-zinc-100"
      >
        {coverImage ? (
          <Image
            src={coverImage}
            alt={titleText}
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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-900/90 via-zinc-900/55 to-transparent px-3 pb-3 pt-12 text-white">
          <span className="mb-2 inline-flex rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-zinc-800">
            {typeLabel}
          </span>
          <p className="mb-2 line-clamp-2 break-words text-sm font-semibold leading-snug text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">
            {titleText}
          </p>
          <p className="text-sm font-semibold tabular-nums text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">
            {priceLabel}
          </p>
        </div>
      </Link>

      <div className="border-t border-zinc-100 px-4 py-2.5 text-xs text-zinc-600">
        {footerRight != null ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
              {footerLeft}
            </div>
            <div className="flex shrink-0 items-center justify-end">{footerRight}</div>
          </div>
        ) : (
          <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
            {footerLeft}
          </div>
        )}
      </div>
    </li>
  );
}
