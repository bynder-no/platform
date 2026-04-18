/**
 * PostgREST `.or()` filter for public listing queries:
 * — fixed_price: active only (unchanged)
 * — auction: only while live — now >= starts (or no starts_at) AND now < ends_at
 * — auction, start has passed: draft or active (time-based visibility without publish job)
 *
 * ISO timestamps must be double-quoted: unquoted values break at `.` (milliseconds),
 * so `lte` never matches and started auctions stay invisible.
 */
function postgrestQuotedInstant(iso: string) {
  const escaped = iso.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function publicListingFeedOrFilter(nowIso: string) {
  const ts = postgrestQuotedInstant(nowIso);
  return [
    "and(type.eq.fixed_price,status.eq.active)",
    `and(type.eq.auction,auction_starts_at.is.null,status.eq.active,auction_ends_at.gt.${ts})`,
    `and(type.eq.auction,auction_starts_at.lte.${ts},status.eq.draft,auction_ends_at.gt.${ts})`,
    `and(type.eq.auction,auction_starts_at.lte.${ts},status.eq.active,auction_ends_at.gt.${ts})`,
  ].join(",");
}
