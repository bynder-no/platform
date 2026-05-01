import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";

import { FixedPriceOfferForm } from "@/app/listings/[id]/fixed-price-offer-form";
import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";
import { normalizeListingImageUrls } from "@/lib/listing-images";

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

function formatPostedAt(createdAt: string | null) {
  if (!createdAt) return "Lagt ut: —";
  const timeMs = new Date(createdAt).getTime();
  if (!Number.isFinite(timeMs)) return "Lagt ut: —";

  const diffMs = Date.now() - timeMs;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return "Lagt ut: nettopp";
  if (diffMinutes < 60) return `Lagt ut: ${diffMinutes} min siden`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Lagt ut: ${diffHours} t siden`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Lagt ut: ${diffDays} d siden`;

  return `Lagt ut: ${new Date(timeMs).toLocaleDateString("nb-NO")}`;
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
        const displayName = String(seller.display_name ?? "").trim();
        const sellerLabel = displayName || username;
        if (sellerId !== "" && sellerLabel !== "") {
          sellerNameById.set(sellerId, sellerLabel);
        }
        if (sellerId !== "" && username !== "") {
          sellerUsernameById.set(sellerId, username);
        }
      }
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
          <ul className="mx-auto flex w-full max-w-2xl flex-col gap-4">
            {listings.map((row) => {
              const sellerId = String(row.seller_id ?? "").trim();
              const sellerName = sellerNameById.get(sellerId);
              const sellerUsername = sellerUsernameById.get(sellerId);
              const sellerHref =
                sellerUsername != null
                  ? `/u/${encodeURIComponent(sellerUsername)}`
                  : null;
              const typeLabel =
                row.type === "auction"
                  ? "Auksjon"
                  : row.type === "fixed_price"
                    ? "Fastpris"
                    : "Annonse";
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
                <li key={row.id} className="ui-card overflow-hidden text-sm">
                  <div className="flex flex-col">
                    <div className="space-y-1 px-4 py-3">
                      <p className="text-sm font-semibold text-zinc-900">
                        {sellerHref ? (
                          <Link href={sellerHref} className="hover:underline">
                            {sellerName ?? "Ukjent selger"}
                          </Link>
                        ) : (
                          sellerName ?? "Ukjent selger"
                        )}
                      </p>
                      <p className="text-xs text-zinc-500">
                        la ut en annonse · {formatPostedAt(row.created_at).replace("Lagt ut: ", "")}
                      </p>
                    </div>
                    {coverImage ? (
                      <Image
                        src={coverImage}
                        alt={row.title?.trim() || "Annonsebilde"}
                        width={960}
                        height={540}
                        unoptimized
                        className="h-72 w-full border-y border-zinc-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-72 w-full items-center justify-center border-y border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-500">
                        Ingen bilde
                      </div>
                    )}
                    <div className="space-y-2 px-4 py-3">
                      <p>
                        <span className="ui-badge ui-badge-accent">{typeLabel}</span>
                      </p>
                      <Link
                        href={`/listings/${row.id}`}
                        className="line-clamp-2 text-base font-semibold text-zinc-900 hover:underline"
                      >
                        {row.title?.trim() || "—"}
                      </Link>
                      <p className="text-base font-semibold text-zinc-900">
                        {priceLabel}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 pt-1 text-sm">
                        <Link
                          href={`/listings/${row.id}`}
                          className="ui-button-secondary px-4 py-2 text-sm font-semibold no-underline"
                        >
                          Se annonse
                        </Link>
                        <span className="text-zinc-600">
                          ♡ Favoritt
                        </span>
                        {showFixedPriceOffer ? (
                          <div className="[&>div]:mt-0">
                            <FixedPriceOfferForm
                              listingId={row.id}
                              defaultOfferNok={
                                row.price_nok != null && Number.isFinite(Number(row.price_nok))
                                  ? Math.max(1, Math.trunc(Number(row.price_nok)))
                                  : 1
                              }
                              listingTitle={row.title?.trim() || "Annonse"}
                              originalPriceNok={
                                row.price_nok != null && Number.isFinite(Number(row.price_nok))
                                  ? Math.trunc(Number(row.price_nok))
                                  : null
                              }
                              thumbnailUrl={coverImage}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
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
