/** Outcome copy for `listing_deals` seller/bidder decisions (Norwegian). */
export function listingDealOutcomeText(
  sellerDecision: string,
  bidderDecision: string,
): string {
  if (sellerDecision === "no_deal" || bidderDecision === "no_deal") {
    return "Handelen ble ikke gjennomført";
  }
  if (sellerDecision === "deal" && bidderDecision === "deal") {
    return "Begge har godkjent handelen";
  }
  return "Venter på svar";
}
