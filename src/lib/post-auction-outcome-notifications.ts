import type { SupabaseClient } from "@supabase/supabase-js";

/** Idempotent inserts for won_auction / auction_no_result from listings.auction_outcome (DB function). */
export async function notifyPostAuctionOutcomeIfResolved(
  supabase: SupabaseClient,
  listingId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: listing } = await supabase
    .from("listings")
    .select("auction_outcome, seller_id")
    .eq("id", listingId)
    .maybeSingle();
  const outcome =
    listing?.auction_outcome != null
      ? String(listing.auction_outcome).trim()
      : null;
  const sellerId =
    listing?.seller_id != null ? String(listing.seller_id).trim() : null;

  const { data: topBid } = await supabase
    .from("bids")
    .select("bidder_id")
    .eq("listing_id", listingId)
    .order("amount_nok", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const highestBidderId =
    topBid?.bidder_id != null ? String(topBid.bidder_id).trim() : null;

  if (outcome === "deal_opened") {
    console.log("WON NOTIFICATION CHECK", { listingId, outcome, highestBidderId });
  }

  const { error } = await supabase.rpc(
    "create_post_auction_notifications_for_resolved_auction",
    { p_listing_id: listingId },
  );
  if (error) {
    return { ok: false, message: error.message };
  }

  if (outcome === "deal_opened" && highestBidderId) {
    const { data: wonNotification } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", highestBidderId)
      .eq("type", "won_auction")
      .eq("listing_id", listingId)
      .limit(1)
      .maybeSingle();

    if (!wonNotification) {
      const { error: retryError } = await supabase.rpc(
        "create_post_auction_notifications_for_resolved_auction",
        { p_listing_id: listingId },
      );
      if (retryError) {
        return { ok: false, message: retryError.message };
      }
    }
  }

  if (outcome === "deal_opened" && sellerId) {
    console.log("SELLER DEAL NOTIFY CHECK", { listingId, sellerId, outcome });
    const { data: existingSellerDealNotify, error: existingSellerDealNotifyErr } =
      await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", sellerId)
        .eq("type", "deal_action_required")
        .eq("listing_id", listingId)
        .limit(1)
        .maybeSingle();

    if (existingSellerDealNotifyErr) {
      console.error("SELLER DEAL NOTIFY ERROR", {
        listingId,
        sellerId,
        message: existingSellerDealNotifyErr.message,
      });
      return { ok: false, message: existingSellerDealNotifyErr.message };
    }

    if (!existingSellerDealNotify) {
      const { error: sellerDealNotifyErr } = await supabase.rpc(
        "create_notification",
        {
          p_user_id: sellerId,
          p_type: "deal_action_required",
          p_listing_id: listingId,
          p_message: "Du har en ny deal – gå til Mine deals",
        },
      );
      if (sellerDealNotifyErr) {
        console.error("SELLER DEAL NOTIFY ERROR", {
          listingId,
          sellerId,
          message: sellerDealNotifyErr.message,
        });
        return { ok: false, message: sellerDealNotifyErr.message };
      }
      console.log("SELLER DEAL NOTIFY OK", { listingId, sellerId });
    }
  }

  return { ok: true };
}
