/**
 * Seller deal room for fixed-price offer alerts (Varsler → seller workflow).
 */
export function fixedPriceOfferSellerDealHref(
  listingId: string,
  buyerId?: string | null,
): string {
  const params = new URLSearchParams();
  params.set("type", "fixed_price");
  const buyer = typeof buyerId === "string" ? buyerId.trim() : "";
  if (buyer !== "") {
    params.set("buyer", buyer);
  }
  return `/my-auctions/${listingId}?${params.toString()}`;
}
