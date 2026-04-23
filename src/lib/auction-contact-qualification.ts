export type AuctionContactQualificationInput = {
  useReservePrice: boolean;
  reservePriceNok: number | string | null;
  contactThresholdPercent: number | string | null;
  highestBid: number;
  hasBids: boolean;
};

export function qualifiesAuctionContactFromHighestBid(
  input: AuctionContactQualificationInput,
): boolean {
  if (!input.hasBids) return false;
  if (!input.useReservePrice) return true;

  const reserve =
    input.reservePriceNok != null && Number.isFinite(Number(input.reservePriceNok))
      ? Number(input.reservePriceNok)
      : Number.NaN;
  const pct =
    input.contactThresholdPercent != null &&
    Number.isFinite(Number(input.contactThresholdPercent))
      ? Number(input.contactThresholdPercent)
      : Number.NaN;
  if (!Number.isFinite(reserve) || !Number.isFinite(pct)) return false;

  const contactOpensAtNok = Math.ceil((reserve * pct) / 100);
  return input.highestBid >= contactOpensAtNok;
}
