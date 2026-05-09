import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";

import { HomeCardFavoriteButton } from "@/app/home-card-favorite-button";
import { FixedPriceOfferForm } from "@/app/listings/[id]/fixed-price-offer-form";
import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";
import { normalizeListingImageUrls } from "@/lib/listing-images";
import { userPublicLabel } from "@/lib/user-display-name";

export const dynamic = "force-dynamic";

type FollowingListingRow = {
  id: string;
  title: string | null;
  type: string | null;
  status: string | null;
  price_nok: number | null;
  image_urls: unknown;
  seller_id: string | null;
  created_at: string | null;
};

type BidRow = {
  listing_id: string;
  amount_nok: number | null;
};

function typeLabel(type: string | null) {
  if (type === "auction") return "Auksjon";
  if (type === "fixed_price") return "Fastpris";
  return "Annonse";
}

export default async function FollowingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error: publishDueError } = await supabase.rpc("publish_due_auctions");
  if (publishDueError) {
    console.error("publish_due_auctions:", publishDueError.message);
  }

  const { data: followRows, error: followsError } = await supabase
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", user.id);

  if (followsError) {
    throw new Error(`Could not load follows: ${followsError.message}`);
  }

  const followingIds = (followRows ?? [])
    .map((row) => String(row.following_id ?? "").trim())
    .filter((id) => id !== "");

  let listings: FollowingListingRow[] = [];
  const sellerNameById = new Map<string, string>();
  const sellerUsernameById = new Map<string, string>();
  const highestBidByListingId = new Map<string, number>();

  if (followingIds.length > 0) {
    const { data: listingRows, error: listingsError } = await supabase
      .from("listings")
      .select("id, title, type, status, price_nok, image_urls, seller_id, created_at")
      .in("seller_id", followingIds)
      .or("and(type.eq.fixed_price,status.eq.active),and(type.eq.auction,status.eq.active)")
      .order("created_at", { ascending: false });

    if (listingsError) {
      throw new Error(`Could not load following listings: ${listingsError.message}`);
    }

    listings = (listingRows ?? []) as FollowingListingRow[];

    const listingIds = listings.map((row) => row.id);
    if (listingIds.length > 0) {
      const { data: bidRows, error: bidsError } = await supabase
        .from("bids")
        .select("listing_id, amount_nok")
        .in("listing_id", listingIds);

      if (bidsError) {
        throw new Error(`Could not load auction bids: ${bidsError.message}`);
      }

      for (const bidRow of (bidRows ?? []) as BidRow[]) {
        const listingId = String(bidRow.listing_id ?? "").trim();
        const amount = Number(bidRow.amount_nok);
        if (!listingId || !Number.isFinite(amount)) continue;
        const prev = highestBidByListingId.get(listingId);
        if (prev == null || amount > prev) {
          highestBidByListingId.set(listingId, amount);
        }
      }
    }

    const sellerIds = [
      ...new Set(
        listings
          .map((row) => String(row.seller_id ?? "").trim())
          .filter((id) => id !== ""),
      ),
    ];

    if (sellerIds.length > 0) {
      const { data: sellerRows, error: sellerError } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", sellerIds);

      if (sellerError) {
        throw new Error(`Could not load seller profiles: ${sellerError.message}`);
      }

      for (const seller of sellerRows ?? []) {
        const sellerId = String(seller.id ?? "").trim();
        const username = String(seller.username ?? "").trim();
        const sellerLabel = userPublicLabel(username, seller.display_name, "");
        if (sellerId !== "" && sellerLabel !== "") {
          sellerNameById.set(sellerId, sellerLabel);
        }
        if (sellerId !== "" && username !== "") {
          sellerUsernameById.set(sellerId, username);
        }
      }
    }
  }

  const favoriteIdSet = new Set<string>();
  const listingIdsForFavorites = listings
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string" && id !== "");
  if (listingIdsForFavorites.length > 0) {
    const { data: favRows, error: favErr } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in("listing_id", listingIdsForFavorites);

    if (favErr) {
      throw new Error(`Could not load favorites: ${favErr.message}`);
    }
    for (const r of favRows ?? []) {
      const lid = r.listing_id;
      if (typeof lid === "string" && lid !== "") favoriteIdSet.add(lid);
    }
  }

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <h1 className={pageTitleClass}>Følger</h1>
      </header>

      <section className={pageBodyGapClass}>
        {followingIds.length === 0 ? (
          <p className="text-sm text-zinc-600">
            Du følger ingen ennå. Gå til en offentlig profil for å følge brukere.
          </p>
        ) : listings.length === 0 ? (
          <p className="text-sm text-zinc-600">
            Ingen aktive annonser fra brukere du følger akkurat nå.
          </p>
        ) : (
          <ul className="mx-auto flex w-full max-w-[26rem] flex-col gap-4 sm:max-w-[29rem]">
            {listings.map((row) => {
              const sellerId = String(row.seller_id ?? "").trim();
              const sellerName = sellerNameById.get(sellerId);
              const sellerUsername = sellerUsernameById.get(sellerId);
              const sellerHref =
                sellerUsername != null
                  ? `/u/${encodeURIComponent(sellerUsername)}`
                  : null;
              const typeLbl = typeLabel(row.type);
              const coverImage = normalizeListingImageUrls(row.image_urls)[0] ?? null;
              const highestBid = highestBidByListingId.get(row.id);
              const priceLabel =
                row.type === "auction"
                  ? highestBid != null
                    ? `Høyeste bud: ${highestBid} NOK`
                    : row.price_nok != null
                      ? `Startpris: ${row.price_nok} NOK`
                      : "Pris mangler"
                  : row.price_nok != null
                    ? `Fastpris: ${row.price_nok} NOK`
                    : "Pris mangler";
              const showFixedPriceOffer =
                user != null &&
                row.type === "fixed_price" &&
                row.status === "active" &&
                sellerId !== "" &&
                sellerId !== user.id;

              return (
                <li
                  key={row.id}
                  className="ui-card overflow-hidden transition duration-200 hover:-translate-y-0.5"
                >
                  <div className="border-b border-zinc-100 px-3.5 py-2">
                    <p className="text-sm font-semibold text-zinc-900">
                      {sellerHref ? (
                        <Link href={sellerHref} className="hover:underline">
                          {sellerName ?? "Ukjent selger"}
                        </Link>
                      ) : (
                        sellerName ?? "Ukjent selger"
                      )}
                    </p>
                  </div>

                  <Link
                    href={`/listings/${row.id}`}
                    className="group relative block aspect-[5/6] w-full overflow-hidden bg-zinc-100"
                  >
                    {coverImage ? (
                      <Image
                        src={coverImage}
                        alt={row.title?.trim() || "Annonsebilde"}
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
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-900/90 via-zinc-900/55 to-transparent px-2.5 pb-2.5 pt-10 text-white">
                      <span className="mb-1.5 inline-flex rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-zinc-800">
                        {typeLbl}
                      </span>
                      <p className="mb-1.5 line-clamp-2 break-words text-sm font-semibold leading-snug text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">
                        {row.title?.trim() || "—"}
                      </p>
                      <p className="text-sm font-semibold tabular-nums text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">
                        {priceLabel}
                      </p>
                    </div>
                  </Link>

                  <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-3.5 py-2 text-xs text-zinc-600">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-2">
                      {sellerHref ? (
                        <Link href={sellerHref} className="hover:underline">
                          Se profil
                        </Link>
                      ) : null}
                      <Link
                        href={`/listings/${row.id}`}
                        className="hover:underline"
                      >
                        Se annonse
                      </Link>
                      {showFixedPriceOffer ? (
                        <div className="min-w-0 basis-full sm:basis-auto [&>div]:mt-0">
                          <FixedPriceOfferForm
                            listingId={row.id}
                            defaultOfferNok={
                              row.price_nok != null &&
                              Number.isFinite(Number(row.price_nok))
                                ? Math.max(1, Math.trunc(Number(row.price_nok)))
                                : 1
                            }
                            listingTitle={row.title?.trim() || "Annonse"}
                            originalPriceNok={
                              row.price_nok != null &&
                              Number.isFinite(Number(row.price_nok))
                                ? Math.trunc(Number(row.price_nok))
                                : null
                            }
                            thumbnailUrl={coverImage}
                          />
                        </div>
                      ) : null}
                    </div>
                    {sellerId !== "" && sellerId !== user.id ? (
                      <HomeCardFavoriteButton
                        listingId={row.id}
                        isFavorite={favoriteIdSet.has(row.id)}
                        returnTo="/following"
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
