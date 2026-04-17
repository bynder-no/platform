/** Post-deal dual-confirmation status (Norwegian), deal room display only. */
export function postDealFulfillmentStatusText(
  viewer: "seller" | "bidder",
  sellerDecision: string,
  bidderDecision: string,
  buyerReceivedCard: boolean,
  sellerReceivedPayment: boolean,
): string | null {
  if (sellerDecision !== "deal" || bidderDecision !== "deal") {
    return null;
  }
  if (buyerReceivedCard && sellerReceivedPayment) {
    return null;
  }

  if (!buyerReceivedCard && !sellerReceivedPayment) {
    return viewer === "bidder"
      ? "Deal bekreftet – Du venter på ditt kort"
      : "Deal bekreftet – Mottaker venter på kort";
  }

  if (buyerReceivedCard && !sellerReceivedPayment) {
    return viewer === "bidder"
      ? "Venter på at selger bekrefter betaling"
      : "Kjøper venter på at du bekrefter mottatt betaling";
  }

  if (!buyerReceivedCard && sellerReceivedPayment) {
    return viewer === "seller"
      ? "Venter på at kjøper bekrefter kort mottatt"
      : "Selger venter på at du bekrefter kort mottatt";
  }

  return null;
}
