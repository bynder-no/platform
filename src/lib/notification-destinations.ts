import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Unread Varsler count for the nav badge (excludes normal chat notification rows).
 */
export async function getVarslerUnreadCount(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false)
    .neq("type", "message_request")
    .neq("type", "new_message");

  if (error) {
    console.error("varsler unread count:", error.message);
    return 0;
  }
  return count ?? 0;
}

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
