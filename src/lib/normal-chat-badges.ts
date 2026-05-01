import type { SupabaseClient } from "@supabase/supabase-js";

/** Notification rows created for normal (profile) chat — excluded from Varsler UI. */
export const NORMAL_CHAT_NOTIFICATION_TYPES = [
  "message_request",
  "new_message",
] as const;

export type NormalChatNotificationType =
  (typeof NORMAL_CHAT_NOTIFICATION_TYPES)[number];

export function isNormalChatNotificationType(type: string): boolean {
  return (NORMAL_CHAT_NOTIFICATION_TYPES as readonly string[]).includes(type);
}

/**
 * Nav badge for Messages: pending incoming chat requests plus unread inbound messages
 * in accepted threads (messages from the other user with read_at null).
 */
export async function getMessagesNavBadgeCount(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count: pendingCount, error: pendingError } = await supabase
    .from("conversation_threads")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .eq("status", "pending");

  if (pendingError) {
    console.error("messages badge pending count:", pendingError.message);
  }

  const { data: acceptedThreads, error: acceptedError } = await supabase
    .from("conversation_threads")
    .select("id")
    .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
    .eq("status", "accepted");

  if (acceptedError) {
    console.error("messages badge accepted threads:", acceptedError.message);
    return pendingCount ?? 0;
  }

  const acceptedIds = (acceptedThreads ?? []).map((row) => row.id);
  if (acceptedIds.length === 0) {
    return pendingCount ?? 0;
  }

  const { count: unreadCount, error: unreadError } = await supabase
    .from("conversation_messages")
    .select("id", { count: "exact", head: true })
    .in("thread_id", acceptedIds)
    .neq("sender_id", userId)
    .is("read_at", null);

  if (unreadError) {
    console.error("messages badge unread count:", unreadError.message);
    return pendingCount ?? 0;
  }

  return (pendingCount ?? 0) + (unreadCount ?? 0);
}

/** Unread inbound messages per thread (other user's messages with read_at null). */
export async function getUnreadInboundCountsByThreadId(
  supabase: SupabaseClient,
  userId: string,
  threadIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (threadIds.length === 0) {
    return counts;
  }

  const { data, error } = await supabase
    .from("conversation_messages")
    .select("thread_id")
    .in("thread_id", threadIds)
    .neq("sender_id", userId)
    .is("read_at", null);

  if (error) {
    console.error("unread counts by thread:", error.message);
    return counts;
  }

  for (const row of data ?? []) {
    const tid = String((row as { thread_id: string }).thread_id);
    counts.set(tid, (counts.get(tid) ?? 0) + 1);
  }

  return counts;
}
