import { createClient } from "@/lib/supabase/server";
import { userPublicLabel } from "@/lib/user-display-name";

export const DISCOVER_BATCH_SIZE = 18;
const DISCOVER_POOL_SIZE = 360;

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

type ListingRow = {
  id: string;
  title: string | null;
  type: string | null;
  status: string | null;
  price_nok: number | null;
  image_urls: unknown;
  seller_id: string | null;
  created_at: string | null;
  auction_starts_at: string | null;
  auction_ends_at: string | null;
};

function hash32(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle(rows: ListingRow[], seed: string) {
  return [...rows].sort((a, b) => {
    const aId = String(a.id ?? "").trim();
    const bId = String(b.id ?? "").trim();
    const aKey = hash32(`${seed}:${aId}`);
    const bKey = hash32(`${seed}:${bId}`);
    if (aKey !== bKey) return aKey - bKey;
    return aId.localeCompare(bId);
  });
}

export async function getDiscoverShuffledItems({
  seed,
  viewerUserId,
}: {
  seed: string;
  viewerUserId: string | null;
}) {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const { data: listingRows, error: listingsError } = await supabase
    .from("listings")
    .select(
      "id, title, type, status, price_nok, image_urls, seller_id, created_at, auction_starts_at, auction_ends_at",
    )
    .or(
      `and(type.eq.fixed_price,status.eq.active),and(type.eq.auction,status.eq.active,auction_ends_at.gt."${nowIso}",auction_starts_at.is.null),and(type.eq.auction,status.eq.active,auction_ends_at.gt."${nowIso}",auction_starts_at.lte."${nowIso}")`,
    )
    .order("created_at", { ascending: false })
    .limit(DISCOVER_POOL_SIZE);

  if (listingsError) {
    throw new Error(`Could not load discover listings: ${listingsError.message}`);
  }

  const filteredRows = ((listingRows ?? []) as ListingRow[]).filter((row) => {
    const sellerId = String(row.seller_id ?? "").trim();
    if (viewerUserId != null && sellerId !== "" && sellerId === viewerUserId) {
      return false;
    }
    if (row.type === "fixed_price") {
      return row.status === "active";
    }
    if (row.type === "auction") {
      if (row.status !== "active") return false;
      const endsAtMs = row.auction_ends_at ? new Date(row.auction_ends_at).getTime() : Number.NaN;
      if (!Number.isFinite(endsAtMs) || endsAtMs <= Date.now()) return false;
      if (!row.auction_starts_at) return true;
      const startsAtMs = new Date(row.auction_starts_at).getTime();
      return Number.isFinite(startsAtMs) && startsAtMs <= Date.now();
    }
    return false;
  });

  const shuffled = seededShuffle(filteredRows, seed);

  const listingIds = shuffled
    .map((row) => String(row.id ?? "").trim())
    .filter((id) => id !== "");
  const sellerIds = Array.from(
    new Set(
      shuffled
        .map((row) => String(row.seller_id ?? "").trim())
        .filter((id) => id !== ""),
    ),
  );

  const highestBidByListingId = new Map<string, number | null>();
  if (listingIds.length > 0) {
    const { data: bidRows, error: bidsError } = await supabase
      .from("bids")
      .select("listing_id, amount_nok")
      .in("listing_id", listingIds);
    if (bidsError) {
      throw new Error(`Could not load discover bids: ${bidsError.message}`);
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

  const sellerNameById = new Map<string, string>();
  const sellerUsernameById = new Map<string, string>();
  if (sellerIds.length > 0) {
    const { data: sellerRows, error: sellersError } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", sellerIds);
    if (sellersError) {
      throw new Error(`Could not load discover sellers: ${sellersError.message}`);
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

  const items: DiscoverGridItem[] = shuffled.map((row) => {
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
    };
  });

  return items;
}
