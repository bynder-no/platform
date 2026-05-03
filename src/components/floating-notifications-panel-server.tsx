import { FloatingNotificationsPanel } from "@/components/floating-notifications-panel";
import { createClient } from "@/lib/supabase/server";
import { isNormalChatNotificationType } from "@/lib/normal-chat-badges";
import type { NotificationRow } from "@/lib/notification-display";

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

  const listingIds = [
    ...new Set(
      notifications
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
      initialNotifications={notifications}
      listingTitleById={listingTitleById}
    />
  );
}
