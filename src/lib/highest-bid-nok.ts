/** Same tie-break as `leadingBidForListing` on my-auctions (newer bid wins on equal amount). */
type BidLike = {
  amount_nok: number | string | null;
  created_at: string | null;
};

export function highestBidNokFromBids(bids: BidLike[]): number {
  let highestNok = 0;
  let leading: BidLike | null = null;
  for (const b of bids) {
    const n = Number(b.amount_nok);
    if (!Number.isFinite(n)) continue;
    if (!leading || n > highestNok) {
      highestNok = n;
      leading = b;
    } else if (n === highestNok && leading) {
      const tNew = b.created_at ? new Date(b.created_at).getTime() : -1;
      const tOld = leading.created_at
        ? new Date(leading.created_at).getTime()
        : -1;
      if (tNew > tOld) leading = b;
    }
  }
  return highestNok;
}

export type BidWithListingId = BidLike & { listing_id: string | null };

export function highestNokByListingId(
  rows: BidWithListingId[],
): Map<string, number> {
  const byListing = new Map<string, BidLike[]>();
  for (const r of rows) {
    const lid = r.listing_id;
    if (!lid || typeof lid !== "string") continue;
    const arr = byListing.get(lid) ?? [];
    arr.push(r);
    byListing.set(lid, arr);
  }
  const out = new Map<string, number>();
  for (const [lid, bids] of byListing) {
    out.set(lid, highestBidNokFromBids(bids));
  }
  return out;
}
