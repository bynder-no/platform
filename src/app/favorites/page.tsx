import Link from "next/link";
import { redirect } from "next/navigation";

import type { DiscoverGridItem } from "@/app/discover/discover-grid";
import { createClient } from "@/lib/supabase/server";
import { userPublicLabel } from "@/lib/user-display-name";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";

import { FavoritesGrid } from "./favorites-grid";

export const dynamic = "force-dynamic";

type ListingRow = {
  id: string;
  title: string | null;
  type: string | null;
  price_nok: number | null;
  image_urls: unknown;
  seller_id: string | null;
  created_at: string | null;
};

export default async function FavoritesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: favoriteRows, error: favoritesError } = await supabase
    .from("favorites")
    .select("listing_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (favoritesError) {
    throw new Error(`Could not load favorites: ${favoritesError.message}`);
  }

  const favList = favoriteRows ?? [];
  const listingIds = favList.map((r) => r.listing_id);

  let items: DiscoverGridItem[] = [];

  if (listingIds.length > 0) {
    const { data: listings, error: listingsError } = await supabase
      .from("listings")
      .select("id, title, type, price_nok, image_urls, seller_id, created_at")
      .in("id", listingIds);

    if (listingsError) {
      throw new Error(`Could not load listings: ${listingsError.message}`);
    }

    const rows = ((listings ?? []) as ListingRow[]).filter(Boolean);
    const byId = new Map(rows.map((l) => [l.id, l]));

    const auctionIds = rows
      .filter((r) => String(r.type ?? "").trim() === "auction")
      .map((r) => String(r.id ?? "").trim())
      .filter((id) => id !== "");

    const highestBidByListingId = new Map<string, number | null>();
    if (auctionIds.length > 0) {
      const { data: bidRows, error: bidsError } = await supabase
        .from("bids")
        .select("listing_id, amount_nok")
        .in("listing_id", auctionIds);

      if (bidsError) {
        throw new Error(`Could not load bids: ${bidsError.message}`);
      }

      for (const bidRow of bidRows ?? []) {
        const listingId = String(bidRow.listing_id ?? "").trim();
        const amount = Number(bidRow.amount_nok);
        if (!listingId || !Number.isFinite(amount)) continue;
        const previous = highestBidByListingId.get(listingId);
        if (previous == null || amount > previous) {
          highestBidByListingId.set(listingId, amount);
        }
      }
    }

    const sellerIds = [
      ...new Set(
        rows
          .map((row) => String(row.seller_id ?? "").trim())
          .filter((id) => id !== ""),
      ),
    ];

    const sellerNameById = new Map<string, string>();
    const sellerUsernameById = new Map<string, string>();
    if (sellerIds.length > 0) {
      const { data: sellerRows, error: sellersError } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", sellerIds);

      if (sellersError) {
        throw new Error(`Could not load sellers: ${sellersError.message}`);
      }

      for (const seller of sellerRows ?? []) {
        const sellerId = String(seller.id ?? "").trim();
        const username = String(seller.username ?? "").trim();
        const displayName = String(seller.display_name ?? "").trim();
        if (sellerId && (username || displayName)) {
          sellerNameById.set(
            sellerId,
            userPublicLabel(username, displayName, "Ukjent selger"),
          );
        }
        if (sellerId && username) {
          sellerUsernameById.set(sellerId, username);
        }
      }
    }

    items = favList
      .map((f) => {
        const row = byId.get(f.listing_id);
        if (!row) return null;
        const listingId = String(row.id ?? "").trim();
        const sellerId = String(row.seller_id ?? "").trim();
        return {
          id: listingId,
          title: row.title,
          type: row.type,
          price_nok: row.price_nok,
          image_urls: row.image_urls,
          seller_name: sellerNameById.get(sellerId) ?? "Ukjent selger",
          seller_username: sellerUsernameById.get(sellerId) ?? null,
          highest_bid_nok: highestBidByListingId.get(listingId) ?? null,
        } satisfies DiscoverGridItem;
      })
      .filter((x): x is DiscoverGridItem => x != null);
  }

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <h1 className={pageTitleClass}>Favoritter</h1>
        <p className="text-sm text-zinc-600">
          Annonser du har lagret.{" "}
          <Link
            href="/discover"
            className="font-medium text-zinc-800 underline-offset-2 hover:underline"
          >
            Utforsk flere
          </Link>
        </p>
      </header>

      <section className={pageBodyGapClass}>
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center text-sm text-zinc-600">
            <p className="font-medium text-zinc-800">Ingen favoritter ennå</p>
            <p className="mt-2">
              Trykk på stjernen på en annonse for å legge den til her.
            </p>
          </div>
        ) : (
          <FavoritesGrid items={items} />
        )}
      </section>
    </div>
  );
}
