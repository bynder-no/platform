import Link from "next/link";
import Image from "next/image";

import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";
import { HomeCardFavoriteButton } from "@/app/home-card-favorite-button";
import { HomeListingCarousel } from "@/app/home-listing-carousel";
import { HomeSearchAutocomplete } from "@/app/home-search-autocomplete";
import { publicListingFeedOrFilter } from "@/app/listings/public-auction-feed-filter";
import { formatAuctionTimeRemainingNo } from "@/lib/auction-time-remaining-no";
import {
  highestNokByListingId,
  type BidWithListingId,
} from "@/lib/highest-bid-nok";
import {
  leadingBidderIdByListingId,
  viewerAuctionBidPositionLabel,
  type BidForLeadingRow,
} from "@/lib/auction-viewer-bid-status";
import { normalizeListingImageUrls } from "@/lib/listing-images";
import { HOME_CATEGORY_SHORTCUTS } from "@/lib/home-category-shortcuts";

export const dynamic = "force-dynamic";

type ListingCardRow = {
  id: string;
  title: string | null;
  type: string | null;
  price_nok: number | string | null;
  image_urls: unknown;
  auction_starts_at: string | null;
  auction_ends_at: string | null;
  seller_id: string | null;
};

function CategoryLineIcon({ slug }: { slug: string }) {
  const iconClass = "h-7 w-7 text-sky-600 transition group-hover:-translate-y-0.5 group-hover:text-sky-700";

  if (slug === "single_card") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass} aria-hidden>
        <rect x="5" y="4" width="14" height="16" rx="2.5" />
        <path d="M8 9h8M8 13h6" />
      </svg>
    );
  }
  if (slug === "slab") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass} aria-hidden>
        <path d="M12 3l7 3v5c0 4.5-2.8 7.8-7 10-4.2-2.2-7-5.5-7-10V6l7-3z" />
        <path d="M9.5 12.5l1.8 1.8 3.5-3.5" />
      </svg>
    );
  }
  if (slug === "sealed") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass} aria-hidden>
        <path d="M3 8l9-5 9 5-9 5-9-5z" />
        <path d="M21 8v8l-9 5-9-5V8" />
        <path d="M12 13v8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 10h18M8 5v5M16 5v5" />
    </svg>
  );
}

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

function priceText(nok: number | string | null) {
  if (nok == null) return "—";
  const n = Number(nok);
  return Number.isFinite(n) ? `${n} NOK` : "—";
}

function homeCardSellerUsernameLink(
  sellerId: string | null,
  usernameBySellerId: Map<string, string>,
  viewerUserId: string | null,
) {
  const u = sellerId ? usernameBySellerId.get(sellerId) : undefined;
  if (!u) {
    return (
      <span className="text-zinc-400">—</span>
    );
  }
  const href =
    viewerUserId != null &&
    sellerId != null &&
    viewerUserId === sellerId
      ? "/profile"
      : `/u/${encodeURIComponent(u)}`;
  return (
    <Link
      href={href}
      className="font-medium text-zinc-700 underline-offset-2 hover:underline"
    >
      {u}
    </Link>
  );
}

/** Remaining label: live → until end; planlagt → until start. */
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

type HomeAuctionCardProps = {
  row: ListingCardRow;
  nowMs: number;
  cardClass: string;
  sellerUsernameById: Map<string, string>;
  viewerUserId: string | null;
  auctionHighestNokById: Map<string, number>;
  listingIdsWithAnyAuctionBid: Set<string>;
  auctionLeadingBidderByListingId: Map<string, string | null>;
  favoriteIdSet: Set<string>;
};

function HomeAuctionListingCard({
  row,
  nowMs,
  cardClass,
  sellerUsernameById,
  viewerUserId,
  auctionHighestNokById,
  listingIdsWithAnyAuctionBid,
  auctionLeadingBidderByListingId,
  favoriteIdSet,
}: HomeAuctionCardProps) {
  const coverImage = normalizeListingImageUrls(row.image_urls)[0] ?? null;
  const state = auctionStateLabelNo(
    nowMs,
    row.auction_starts_at ?? null,
    row.auction_ends_at ?? null,
  );
  const liveNok = auctionHighestNokById.get(row.id) ?? 0;
  const bidPositionLabel =
    viewerUserId != null && row.seller_id !== viewerUserId
      ? viewerAuctionBidPositionLabel(
          viewerUserId,
          listingIdsWithAnyAuctionBid.has(row.id),
          auctionLeadingBidderByListingId.get(row.id) ?? null,
        )
      : null;
  const timeLeft = homeAuctionTimeRemainingLabel(
    state,
    row.auction_starts_at ?? null,
    row.auction_ends_at ?? null,
    nowMs,
  );
  return (
    <div
      className={`${cardClass} hover:-translate-y-1 hover:border-zinc-300 hover:shadow-md`}
    >
      {coverImage ? (
        <div className="mb-1.5 overflow-hidden rounded-xl border border-zinc-200">
          <Image
            src={coverImage}
            alt={row.title?.trim() || "Annonsebilde"}
            width={224}
            height={144}
            unoptimized
            className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      ) : (
        <div className="mb-1.5 flex h-44 w-full items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-500">
          Ingen bilde
        </div>
      )}
      <div className="flex items-start gap-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Link
            href={`/listings/${row.id}`}
            className="line-clamp-2 font-semibold text-zinc-900 no-underline outline-none ring-zinc-400 hover:underline focus-visible:ring-2"
          >
            {row.title?.trim() || "—"}
          </Link>
          <p className="text-xs text-zinc-500">
            {homeCardSellerUsernameLink(
              row.seller_id,
              sellerUsernameById,
              viewerUserId,
            )}
          </p>
          <Link
            href={`/listings/${row.id}`}
            className="flex flex-col gap-1 text-inherit no-underline outline-none ring-zinc-400 focus-visible:ring-2"
          >
            <span className="inline-flex w-fit rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              {state}
            </span>
            {timeLeft ? (
              <span className="text-xs text-zinc-500">
                <span className="font-medium text-zinc-600">
                  Tid igjen
                </span>{" "}
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
          </Link>
        </div>
        {viewerUserId &&
        row.seller_id &&
        row.seller_id !== viewerUserId ? (
          <HomeCardFavoriteButton
            listingId={row.id}
            isFavorite={favoriteIdSet.has(row.id)}
          />
        ) : null}
      </div>
    </div>
  );
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: publishDueError } = await supabase.rpc("publish_due_auctions");
  if (publishDueError) {
    console.error("publish_due_auctions:", publishDueError.message);
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();

  const selectCols =
    "id, title, type, price_nok, image_urls, auction_starts_at, auction_ends_at, created_at, seller_id";

  const { data: auctionList, error: auctionErr } = await supabase
    .from("listings")
    .select(selectCols)
    .or(publicListingFeedOrFilter(nowIso))
    .neq("status", "deleted")
    .eq("type", "auction")
    .order("created_at", { ascending: false })
    .limit(4);

  if (auctionErr) {
    throw new Error(`Could not load auction listings: ${auctionErr.message}`);
  }

  const { data: fixedList, error: fixedErr } = await supabase
    .from("listings")
    .select(selectCols)
    .or(publicListingFeedOrFilter(nowIso))
    .neq("status", "deleted")
    .eq("type", "fixed_price")
    .order("created_at", { ascending: false })
    .limit(4);

  if (fixedErr) {
    throw new Error(`Could not load fixed price listings: ${fixedErr.message}`);
  }

  const auctionRows = (auctionList ?? []) as ListingCardRow[];
  const fixedRows = (fixedList ?? []) as ListingCardRow[];

  const sellerIds = [
    ...new Set(
      [...auctionRows, ...fixedRows]
        .map((r) => r.seller_id)
        .filter((id): id is string => typeof id === "string" && id !== ""),
    ),
  ];
  const sellerUsernameById = new Map<string, string>();
  if (sellerIds.length > 0) {
    const { data: sellerProfiles, error: sellerProfErr } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", sellerIds);

    if (sellerProfErr) {
      throw new Error(`Could not load seller profiles: ${sellerProfErr.message}`);
    }
    for (const p of sellerProfiles ?? []) {
      const u = typeof p.username === "string" ? p.username.trim() : "";
      if (p.id && u !== "") sellerUsernameById.set(p.id, u);
    }
  }

  const homeCardIds = [
    ...new Set(
      [...auctionRows, ...fixedRows]
        .map((r) => r.id)
        .filter((id): id is string => typeof id === "string" && id !== ""),
    ),
  ];
  const favoriteIdSet = new Set<string>();
  if (user && homeCardIds.length > 0) {
    const { data: homeFavRows, error: homeFavErr } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in("listing_id", homeCardIds);

    if (homeFavErr) {
      throw new Error(`Could not load favorites: ${homeFavErr.message}`);
    }
    for (const r of homeFavRows ?? []) {
      const lid = r.listing_id;
      if (typeof lid === "string" && lid !== "") favoriteIdSet.add(lid);
    }
  }

  const auctionIds = auctionRows
    .map((r) => r.id)
    .filter((id): id is string => typeof id === "string" && id !== "");
  let auctionHighestNokById = new Map<string, number>();
  const listingIdsWithAnyAuctionBid = new Set<string>();
  let auctionLeadingBidderByListingId = new Map<string, string | null>();
  if (auctionIds.length > 0) {
    const { data: auctionBidRows, error: auctionBidsErr } = await supabase
      .from("bids")
      .select("listing_id, amount_nok, created_at, bidder_id")
      .in("listing_id", auctionIds);

    if (auctionBidsErr) {
      throw new Error(`Could not load bids: ${auctionBidsErr.message}`);
    }
    const flat = (auctionBidRows ?? []) as BidForLeadingRow[];
    for (const r of flat) {
      const lid = r.listing_id;
      if (lid) listingIdsWithAnyAuctionBid.add(lid);
    }
    auctionLeadingBidderByListingId = leadingBidderIdByListingId(flat);
    auctionHighestNokById = highestNokByListingId(
      flat as BidWithListingId[],
    );
  }

  const cardClass =
    "group flex w-full min-w-0 max-w-none flex-col gap-2.5 rounded-2xl border border-zinc-200 bg-white p-3 text-sm shadow-sm transition-all duration-300 ease-out cursor-pointer";

  const sectionTitleClass =
    "text-base font-semibold text-zinc-900";

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <div className="space-y-2">
          <h1 className={pageTitleClass}>Hjem</h1>
          <p className="text-sm text-zinc-500">
            Nyeste auksjoner og fastprisannonser.
          </p>
        </div>

        {user ? (null) : (
          <nav className="flex flex-wrap gap-x-3 gap-y-2 text-sm">
            <Link
              href="/"
              className="font-medium text-zinc-900 underline-offset-2 hover:underline"
            >
              Hjem
            </Link>
            <span className="text-zinc-300" aria-hidden>
              ·
            </span>
            <Link
              href="/login"
              className="font-medium text-zinc-900 underline-offset-2 hover:underline"
            >
              Logg inn
            </Link>
            <span className="text-zinc-300" aria-hidden>
              ·
            </span>
            <Link
              href="/signup"
              className="font-medium text-zinc-900 underline-offset-2 hover:underline"
            >
              Registrer
            </Link>
            <span className="text-zinc-300" aria-hidden>
              ·
            </span>
            <Link
              href="/dashboard"
              className="font-medium text-zinc-900 underline-offset-2 hover:underline"
            >
              Dashboard
            </Link>
          </nav>
        )}
      </header>

      <div className={`${pageBodyGapClass} w-full space-y-11`}>
        <section aria-labelledby="home-search-heading" className="space-y-3">
          <h2
            id="home-search-heading"
            className="text-base font-semibold text-zinc-900"
          >
            Søk i annonser
          </h2>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <HomeSearchAutocomplete />
          </div>
        </section>

        <section aria-labelledby="home-categories-heading" className="space-y-3">
          <h2
            id="home-categories-heading"
            className="text-base font-semibold text-zinc-900"
          >
            Kategorier
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-y-5 sm:grid-cols-4 sm:gap-y-6">
            {HOME_CATEGORY_SHORTCUTS.map((item) => (
              <li key={item.slug}>
                <Link
                  href={item.href}
                  className="group flex flex-col items-center justify-center gap-2 px-2 py-2 text-center transition duration-200"
                >
                  <span className="inline-flex items-center justify-center" aria-hidden>
                    <CategoryLineIcon slug={item.slug} />
                  </span>
                  <span className="text-xs font-semibold leading-snug text-zinc-700">
                    {item.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="home-auctions-heading" className="space-y-1">
          <div className="flex flex-wrap items-end justify-between gap-2 gap-y-1">
            <h2 id="home-auctions-heading" className={sectionTitleClass}>
              Nyeste auksjonsannonser
            </h2>
            <Link
              href="/auctions"
              className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline"
            >
              Se alle
            </Link>
          </div>
          {auctionRows.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              Ingen auksjoner akkurat nå.
            </p>
          ) : (
            <HomeListingCarousel ariaLabel="Auksjonsannonser karusell">
              {auctionRows.map((row) => (
                <li key={row.id} className="py-1">
                  <HomeAuctionListingCard
                    row={row}
                    nowMs={nowMs}
                    cardClass={cardClass}
                    sellerUsernameById={sellerUsernameById}
                    viewerUserId={user?.id ?? null}
                    auctionHighestNokById={auctionHighestNokById}
                    listingIdsWithAnyAuctionBid={listingIdsWithAnyAuctionBid}
                    auctionLeadingBidderByListingId={
                      auctionLeadingBidderByListingId
                    }
                    favoriteIdSet={favoriteIdSet}
                  />
                </li>
              ))}
            </HomeListingCarousel>
          )}
        </section>

        <section aria-labelledby="home-fixed-heading" className="space-y-1">
          <div className="flex flex-wrap items-end justify-between gap-2 gap-y-1">
            <h2 id="home-fixed-heading" className={sectionTitleClass}>
              Nyeste fastprisannonser
            </h2>
            <Link
              href="/fixed-price"
              className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline"
            >
              Se alle
            </Link>
          </div>
          {fixedRows.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              Ingen fastprisannonser akkurat nå.
            </p>
          ) : (
            <HomeListingCarousel ariaLabel="Fastprisannonser karusell">
              {fixedRows.map((row) => (
                <li key={row.id} className="py-1">
                  <div
                    className={`${cardClass} hover:-translate-y-1 hover:border-zinc-300 hover:shadow-md`}
                  >
                    {normalizeListingImageUrls(row.image_urls)[0] ? (
                      <div className="mb-1.5 overflow-hidden rounded-xl border border-zinc-200">
                        <Image
                          src={normalizeListingImageUrls(row.image_urls)[0]}
                          alt={row.title?.trim() || "Annonsebilde"}
                          width={224}
                          height={144}
                          unoptimized
                          className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                    ) : (
                      <div className="mb-1.5 flex h-44 w-full items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-500">
                        Ingen bilde
                      </div>
                    )}
                    <div className="flex items-start gap-2.5">
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <Link
                          href={`/listings/${row.id}`}
                          className="line-clamp-2 font-semibold text-zinc-900 no-underline outline-none ring-zinc-400 hover:underline focus-visible:ring-2"
                        >
                          {row.title?.trim() || "—"}
                        </Link>
                        <p className="text-xs text-zinc-500">
                          {homeCardSellerUsernameLink(
                            row.seller_id,
                            sellerUsernameById,
                            user?.id ?? null,
                          )}
                        </p>
                        <Link
                          href={`/listings/${row.id}`}
                          className="tabular-nums text-lg font-semibold text-zinc-900 no-underline outline-none ring-zinc-400 hover:underline focus-visible:ring-2"
                        >
                          {priceText(row.price_nok)}
                        </Link>
                      </div>
                      {user &&
                      row.seller_id &&
                      row.seller_id !== user.id ? (
                        <HomeCardFavoriteButton
                          listingId={row.id}
                          isFavorite={favoriteIdSet.has(row.id)}
                        />
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </HomeListingCarousel>
          )}
        </section>
      </div>
      </div>
    </div>
  );
}
