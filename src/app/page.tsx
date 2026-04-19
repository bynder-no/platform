import Link from "next/link";

import { SignedInNavLinks } from "@/components/signed-in-nav-links";
import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";
import { HomeCardFavoriteButton } from "@/app/home-card-favorite-button";
import { publicListingFeedOrFilter } from "@/app/listings/public-auction-feed-filter";
import { formatAuctionTimeRemainingNo } from "@/lib/auction-time-remaining-no";
import {
  highestNokByListingId,
  type BidWithListingId,
} from "@/lib/highest-bid-nok";

export const dynamic = "force-dynamic";

type ListingCardRow = {
  id: string;
  title: string | null;
  type: string | null;
  price_nok: number | string | null;
  auction_starts_at: string | null;
  auction_ends_at: string | null;
  seller_id: string | null;
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

function priceText(nok: number | string | null) {
  if (nok == null) return "—";
  const n = Number(nok);
  return Number.isFinite(n) ? `${n} NOK` : "—";
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
    "id, title, type, price_nok, auction_starts_at, auction_ends_at, created_at, seller_id";

  const { data: auctionList, error: auctionErr } = await supabase
    .from("listings")
    .select(selectCols)
    .or(publicListingFeedOrFilter(nowIso))
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
    .eq("type", "fixed_price")
    .order("created_at", { ascending: false })
    .limit(4);

  if (fixedErr) {
    throw new Error(`Could not load fixed price listings: ${fixedErr.message}`);
  }

  const auctionRows = (auctionList ?? []) as ListingCardRow[];
  const fixedRows = (fixedList ?? []) as ListingCardRow[];

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

  const auctionIds = auctionRows.map((r) => r.id).filter(Boolean);
  let auctionHighestNokById = new Map<string, number>();
  if (auctionIds.length > 0) {
    const { data: auctionBidRows, error: auctionBidsErr } = await supabase
      .from("bids")
      .select("listing_id, amount_nok, created_at")
      .in("listing_id", auctionIds);

    if (auctionBidsErr) {
      throw new Error(`Could not load bids: ${auctionBidsErr.message}`);
    }
    auctionHighestNokById = highestNokByListingId(
      (auctionBidRows ?? []) as BidWithListingId[],
    );
  }

  const cardClass =
    "flex min-w-[11rem] max-w-[14rem] flex-1 shrink-0 flex-col gap-1 rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900";

  const sectionTitleClass =
    "text-base font-semibold text-zinc-900 dark:text-zinc-50";

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <div className="space-y-2">
          <h1 className={pageTitleClass}>Hjem</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Nyeste auksjoner og fastprisannonser.
          </p>
        </div>

        {user ? (
          <SignedInNavLinks />
        ) : (
          <nav className="flex flex-wrap gap-x-3 gap-y-2 text-sm">
            <Link
              href="/"
              className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
            >
              Hjem
            </Link>
            <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
              ·
            </span>
            <Link
              href="/login"
              className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
            >
              Logg inn
            </Link>
            <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
              ·
            </span>
            <Link
              href="/signup"
              className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
            >
              Registrer
            </Link>
            <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
              ·
            </span>
            <Link
              href="/dashboard"
              className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
            >
              Dashboard
            </Link>
          </nav>
        )}
      </header>

      <div className={`${pageBodyGapClass} space-y-10`}>
        <section aria-labelledby="home-auctions-heading">
          <div className="flex flex-wrap items-end justify-between gap-2 gap-y-1">
            <h2 id="home-auctions-heading" className={sectionTitleClass}>
              Nyeste auksjonsannonser
            </h2>
            <Link
              href="/auctions"
              className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
            >
              Se alle
            </Link>
          </div>
          {auctionRows.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Ingen auksjoner akkurat nå.
            </p>
          ) : (
            <ul className="mt-4 flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5">
              {auctionRows.map((row) => {
                const state = auctionStateLabelNo(
                  nowMs,
                  row.auction_starts_at ?? null,
                  row.auction_ends_at ?? null,
                );
                const liveNok = auctionHighestNokById.get(row.id) ?? 0;
                const endMs = row.auction_ends_at
                  ? new Date(row.auction_ends_at).getTime()
                  : Number.NaN;
                const tidIggjenLabel = Number.isFinite(endMs)
                  ? formatAuctionTimeRemainingNo(endMs, nowMs)
                  : "—";
                return (
                  <li key={row.id}>
                    <div
                      className={`${cardClass} hover:border-zinc-300 dark:hover:border-zinc-600`}
                    >
                      <div className="flex items-start gap-1">
                        <Link
                          href={`/listings/${row.id}`}
                          className="flex min-w-0 flex-1 flex-col gap-1 text-inherit no-underline outline-none ring-zinc-400 focus-visible:ring-2"
                        >
                          <span className="line-clamp-2 font-medium text-zinc-900 dark:text-zinc-100">
                            {row.title?.trim() || "—"}
                          </span>
                          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            {state}
                          </span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            <span className="font-medium text-zinc-600 dark:text-zinc-300">
                              Tid igjen
                            </span>{" "}
                            <span className="tabular-nums">{tidIggjenLabel}</span>
                          </span>
                          <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
                            {liveNok} NOK
                          </span>
                        </Link>
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
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="home-fixed-heading">
          <div className="flex flex-wrap items-end justify-between gap-2 gap-y-1">
            <h2 id="home-fixed-heading" className={sectionTitleClass}>
              Nyeste fastprisannonser
            </h2>
            <Link
              href="/fixed-price"
              className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
            >
              Se alle
            </Link>
          </div>
          {fixedRows.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Ingen fastprisannonser akkurat nå.
            </p>
          ) : (
            <ul className="mt-4 flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5">
              {fixedRows.map((row) => (
                <li key={row.id}>
                  <div
                    className={`${cardClass} hover:border-zinc-300 dark:hover:border-zinc-600`}
                  >
                    <div className="flex items-start gap-1">
                      <Link
                        href={`/listings/${row.id}`}
                        className="flex min-w-0 flex-1 flex-col gap-1 text-inherit no-underline outline-none ring-zinc-400 focus-visible:ring-2"
                      >
                        <span className="line-clamp-2 font-medium text-zinc-900 dark:text-zinc-100">
                          {row.title?.trim() || "—"}
                        </span>
                        <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
                          {priceText(row.price_nok)}
                        </span>
                      </Link>
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
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
