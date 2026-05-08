import { FloatingNotificationsPanel } from "@/components/floating-notifications-panel";
import { createClient } from "@/lib/supabase/server";
import { isNormalChatNotificationType } from "@/lib/normal-chat-badges";
import {
  isDealRelatedNotificationType,
  type NotificationRow,
} from "@/lib/notification-display";

type ListingDealRow = {
  listing_id: string;
  bidder_id: string;
  seller_id: string;
};

export async function FloatingNotificationsPanelServer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, listing_id, thread_id, bidder_id, message, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("floating notifications:", error.message);
    return null;
  }

  const notifications = ((data ?? []) as NotificationRow[]).filter(
    (row) => !isNormalChatNotificationType(row.type),
  );

  const dealCandidateListingIds = [
    ...new Set(
      notifications
        .filter(
          (row) => isDealRelatedNotificationType(row.type) && !!row.listing_id && !row.thread_id,
        )
        .map((row) => String(row.listing_id ?? "").trim())
        .filter((id) => id !== ""),
    ),
  ];

  const listingDealsByListingId = new Map<string, ListingDealRow[]>();
  if (dealCandidateListingIds.length > 0) {
    const { data: dealRows, error: dealsError } = await supabase
      .from("listing_deals")
      .select("listing_id, bidder_id, seller_id")
      .in("listing_id", dealCandidateListingIds);

    if (dealsError) {
      console.error("floating notifications listing_deals:", dealsError.message);
    } else {
      for (const row of (dealRows ?? []) as ListingDealRow[]) {
        const listingId = String(row.listing_id ?? "").trim();
        if (listingId === "") continue;
        const existing = listingDealsByListingId.get(listingId) ?? [];
        existing.push(row);
        listingDealsByListingId.set(listingId, existing);
      }
    }
  }

  const notificationsWithResolvedThread: NotificationRow[] = notifications.map((row) => {
    if (!isDealRelatedNotificationType(row.type)) return row;
    const fromThreadColumn = String(row.thread_id ?? "").trim();
    if (fromThreadColumn !== "") {
      return { ...row, resolved_thread_id: fromThreadColumn };
    }
    const listingId = String(row.listing_id ?? "").trim();
    if (listingId === "") return row;

    const bidderId = String(row.bidder_id ?? "").trim();
    if (bidderId !== "") {
      return { ...row, resolved_thread_id: `deal:${listingId}:${bidderId}` };
    }

    const listingDeals = listingDealsByListingId.get(listingId) ?? [];
    const viewerDeal = listingDeals.find((deal) => String(deal.bidder_id ?? "").trim() === user.id);
    if (viewerDeal) {
      const viewerBidderId = String(viewerDeal.bidder_id ?? "").trim();
      if (viewerBidderId !== "") {
        return { ...row, resolved_thread_id: `deal:${listingId}:${viewerBidderId}` };
      }
    }

    if (listingDeals.length === 1) {
      const onlyBidder = String(listingDeals[0]?.bidder_id ?? "").trim();
      if (onlyBidder !== "") {
        return { ...row, resolved_thread_id: `deal:${listingId}:${onlyBidder}` };
      }
    }

    if (listingDeals.length > 0) {
      const fallbackBidder = String(listingDeals[0]?.bidder_id ?? "").trim();
      if (fallbackBidder !== "") {
        return { ...row, resolved_thread_id: `deal:${listingId}:${fallbackBidder}` };
      }
    }

    return { ...row, resolved_thread_id: `deal:${listingId}:auction` };
  });

  const listingIds = [
    ...new Set(
      notificationsWithResolvedThread
        .map((n) => n.listing_id)
        .filter((id): id is string => !!id),
    ),
  ];

  const listingTitleById: Record<string, string> = {};
  if (listingIds.length > 0) {
    const { data: listingRows, error: listingError } = await supabase
      .from("listings")
      .select("id, title")
      .in("id", listingIds);
    if (listingError) {
      console.error("floating notifications listings:", listingError.message);
    } else {
      for (const listing of listingRows ?? []) {
        const title = String(listing.title ?? "").trim() || "Annonse";
        listingTitleById[String(listing.id)] = title;
      }
    }
  }

  return (
    <FloatingNotificationsPanel
      initialNotifications={notificationsWithResolvedThread}
      listingTitleById={listingTitleById}
    />
  );
}
