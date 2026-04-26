import type { SupabaseClient } from "@supabase/supabase-js";

type DeleteOwnFixedPriceListingInput = {
  supabase: SupabaseClient;
  listingId: string;
  currentUserId: string;
};

export async function deleteOwnFixedPriceListingById({
  supabase,
  listingId,
  currentUserId,
}: DeleteOwnFixedPriceListingInput): Promise<boolean> {
  if (listingId.trim() === "" || currentUserId.trim() === "") {
    return false;
  }

  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select("id, seller_id, type")
    .eq("id", listingId)
    .maybeSingle();

  if (listingErr) {
    console.error("DELETE FIXED PRICE ERROR", listingErr);
    return false;
  }

  if (
    !listing ||
    listing.type !== "fixed_price" ||
    String(listing.seller_id ?? "").trim() !== currentUserId
  ) {
    return false;
  }

  const { data: soldDeal, error: soldDealErr } = await supabase
    .from("listing_deals")
    .select("listing_id")
    .eq("listing_id", listingId)
    .eq("seller_decision", "deal")
    .eq("bidder_decision", "deal")
    .limit(1)
    .maybeSingle();

  if (soldDealErr) {
    console.error("DELETE FIXED PRICE ERROR", soldDealErr);
    return false;
  }
  if (soldDeal) {
    return false;
  }

  const { data: deletedRows, error: deleteErr } = await supabase
    .from("listings")
    .delete()
    .eq("id", listingId)
    .eq("seller_id", currentUserId)
    .eq("type", "fixed_price")
    .select("id");

  if (deleteErr) {
    console.error("DELETE FIXED PRICE ERROR", deleteErr);
    return false;
  }

  return (deletedRows?.length ?? 0) > 0;
}
