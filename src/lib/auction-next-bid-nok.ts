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
  const minBidIncrementNok =
    minIncrementNok != null && Number.isFinite(Number(minIncrementNok))
      ? Math.trunc(Number(minIncrementNok))
      : null;
  if (startPriceNok == null || startPriceNok < 1) return null;
  if (minBidIncrementNok == null || minBidIncrementNok < 1) return null;
  if (!hasAnyBid) return startPriceNok;
  return highestNok + minBidIncrementNok;
}
