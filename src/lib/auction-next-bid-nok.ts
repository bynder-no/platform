/** Same parsing as `nextValidBidAmountNok` / `placeBid` minimum step. */
export function parsedMinBidIncrementNok(
  minIncrementNok: number | string | null,
): number | null {
  const n =
    minIncrementNok != null && Number.isFinite(Number(minIncrementNok))
      ? Math.trunc(Number(minIncrementNok))
      : null;
  if (n == null || n < 1) return null;
  return n;
}

/**
 * Next valid whole-NOK bid: start price when no bids, else highest + increment.
 * Matches dashboard «Auksjoner du følger» quick-bid and `placeBid` server rules.
 */
export function nextValidBidAmountNok(
  hasAnyBid: boolean,
  highestNok: number,
  priceNok: number | string | null,
  minIncrementNok: number | string | null,
): number | null {
  const startPriceNok =
    priceNok != null && Number.isFinite(Number(priceNok))
      ? Math.trunc(Number(priceNok))
      : null;
  const minBidIncrementNok = parsedMinBidIncrementNok(minIncrementNok);
  if (startPriceNok == null || startPriceNok < 1) return null;
  if (minBidIncrementNok == null) return null;
  if (!hasAnyBid) return startPriceNok;
  return highestNok + minBidIncrementNok;
}
