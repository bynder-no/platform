/** Same tie-break as `highest-bid-nok` / listing leading bid (newer wins on equal amount). */
export type BidForLeadingRow = {
  listing_id: string | null;
  amount_nok: number | string | null;
  created_at: string | null;
  bidder_id: string | null;
};

export function leadingBidderIdByListingId(
  rows: BidForLeadingRow[],
): Map<string, string | null> {
  const byListing = new Map<string, BidForLeadingRow[]>();
  for (const r of rows) {
    const lid = r.listing_id;
    if (!lid || typeof lid !== "string") continue;
    const arr = byListing.get(lid) ?? [];
    arr.push(r);
    byListing.set(lid, arr);
  }
  const out = new Map<string, string | null>();
  for (const [lid, bids] of byListing) {
    let highestNok = 0;
    let leading: BidForLeadingRow | null = null;
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
    const id = leading?.bidder_id;
    out.set(
      lid,
      id != null && String(id).trim() !== "" ? String(id).trim() : null,
    );
  }
  return out;
}

/** Norwegian; never exposes other bidders' identities. Caller should omit for listing seller. */
export function viewerAuctionBidPositionLabel(
  viewerUserId: string | null | undefined,
  hasAnyBidOnListing: boolean,
  leadingBidderId: string | null,
): string | null {
  if (!viewerUserId || !hasAnyBidOnListing || !leadingBidderId) return null;
  if (viewerUserId === leadingBidderId) return "Du leder";
  return "Du er overbydd";
}
