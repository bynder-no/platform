import { createClient } from "@/lib/supabase/server";
import { userPublicLabel } from "@/lib/user-display-name";
import { getUnreadInboundCountsByThreadId } from "@/lib/normal-chat-badges";
import { normalizeListingImageUrls } from "@/lib/listing-images";
import {
  dealRoomStatusBadge,
  resolveDealStatusGroup,
} from "@/app/my-auctions/deal-status-ui";

import { FloatingChatBubble } from "./floating-chat-bubble";
import type { DealPreview, InboxThread } from "./floating-chat/floating-chat-types";

type ThreadRow = {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: string;
  updated_at: string | null;
};

type MessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string | null;
  read_at: string | null;
};

type DealRow = {
  id: string;
  listing_id: string;
  seller_id: string;
  bidder_id: string;
  created_at: string | null;
  seller_decision: string;
  bidder_decision: string;
  buyer_received_card: boolean | null;
  seller_received_payment: boolean | null;
  completed_at: string | null;
};

type DealMessageRow = {
  id: string;
  listing_id: string;
  deal_id: string | null;
  sender_id: string;
  body: string;
  created_at: string | null;
};

function profileLabel(
  p:
    | { display_name: string | null; username: string | null }
    | undefined
    | null,
) {
  if (!p) return "Medlem";
  return userPublicLabel(p.username, p.display_name, "Medlem");
}

function previewText(body: string | null | undefined) {
  const text = String(body ?? "").trim();
  if (!text) return "Ingen meldinger ennå";
  if (text.length <= 42) return text;
  return `${text.slice(0, 42)}...`;
}

function formatWhen(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

export async function FloatingChatBubbleServer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: threadRows, error: threadsError } = await supabase
    .from("conversation_threads")
    .select("id, requester_id, recipient_id, status, updated_at")
    .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order("updated_at", { ascending: false });

  if (threadsError) {
    console.error("floating chat threads:", threadsError.message);
    return null;
  }

  const threads = ((threadRows ?? []) as ThreadRow[]).filter((thread) => {
    if (thread.status === "accepted") return true;
    if (thread.status === "pending" && thread.requester_id === user.id) return true;
    if (thread.status === "pending" && thread.recipient_id === user.id) return true;
    return false;
  });
  const threadIds = threads.map((thread) => thread.id);
  const normalProfileIds = threads.flatMap((thread) => [
    thread.requester_id,
    thread.recipient_id,
  ]);

  const { data: messagesData, error: messagesError } = await supabase
    .from("conversation_messages")
    .select("id, thread_id, sender_id, body, created_at, read_at")
    .in("thread_id", threadIds.length > 0 ? threadIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: true });
  if (messagesError) {
    console.error("floating chat messages:", messagesError.message);
    return null;
  }

  const latestByThreadId = new Map<string, MessageRow>();
  const messagesByThreadId = new Map<string, MessageRow[]>();
  for (const message of (messagesData ?? []) as MessageRow[]) {
    const existing = messagesByThreadId.get(message.thread_id) ?? [];
    existing.push(message);
    messagesByThreadId.set(message.thread_id, existing);
    latestByThreadId.set(message.thread_id, message);
  }

  const acceptedIds = threads
    .filter((thread) => thread.status === "accepted")
    .map((thread) => thread.id);
  const unreadByThreadId = await getUnreadInboundCountsByThreadId(
    supabase,
    user.id,
    acceptedIds,
  );

  const normalChats: InboxThread[] = threads.map((thread) => {
    const otherId =
      thread.requester_id === user.id ? thread.recipient_id : thread.requester_id;
    const last = latestByThreadId.get(thread.id);
    const unreadCount =
      thread.status === "accepted" ? (unreadByThreadId.get(thread.id) ?? 0) : 0;
    return {
      kind: "chat",
      id: thread.id,
      otherName: otherId,
      preview:
        thread.status === "pending" && thread.requester_id === user.id
          ? "Venter på godkjenning"
          : previewText(last?.body),
      when: formatWhen(last?.created_at ?? thread.updated_at),
      status: thread.status,
      requesterId: thread.requester_id,
      recipientId: thread.recipient_id,
      unreadCount,
      messages: (messagesByThreadId.get(thread.id) ?? []).map((message) => ({
        id: message.id,
        senderId: message.sender_id,
        body: message.body,
        createdAt: message.created_at,
      })),
    };
  });

  const { data: dealRowsRaw, error: dealRowsErr } = await supabase
    .from("listing_deals")
    .select(
      "id, listing_id, seller_id, bidder_id, created_at, seller_decision, bidder_decision, buyer_received_card, seller_received_payment, completed_at",
    )
    .or(`seller_id.eq.${user.id},bidder_id.eq.${user.id}`);
  if (dealRowsErr) {
    console.error("floating deal rows:", dealRowsErr.message);
    return <FloatingChatBubble chats={normalChats} currentUserId={user.id} />;
  }
  const dealRows = (dealRowsRaw ?? []) as DealRow[];
  const dealListingIds = [...new Set(dealRows.map((d) => String(d.listing_id).trim()))].filter(
    (id) => id !== "",
  );

  const { data: dealMessagesRaw, error: dealMessagesErr } = await supabase
    .from("listing_deal_messages")
    .select("id, listing_id, deal_id, sender_id, body, created_at")
    .in(
      "listing_id",
      dealListingIds.length > 0 ? dealListingIds : ["00000000-0000-0000-0000-000000000000"],
    )
    .order("created_at", { ascending: true });
  if (dealMessagesErr) {
    console.error("floating deal messages:", dealMessagesErr.message);
  }
  const dealMessages = (dealMessagesRaw ?? []) as DealMessageRow[];

  const { data: listingRowsRaw, error: listingRowsErr } = await supabase
    .from("listings")
    .select("id, title, image_urls, type, created_at")
    .in(
      "id",
      dealListingIds.length > 0 ? dealListingIds : ["00000000-0000-0000-0000-000000000000"],
    );
  if (listingRowsErr) {
    console.error("floating deal listings:", listingRowsErr.message);
  }
  const listingById = new Map(
    (listingRowsRaw ?? []).map((row) => [String(row.id), row] as const),
  );

  const dealProfileIds = dealRows.flatMap((d) => [String(d.seller_id), String(d.bidder_id)]);
  const profileIds = [...new Set([...normalProfileIds, ...dealProfileIds])];
  const { data: profileRows, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .in("id", profileIds.length > 0 ? profileIds : ["00000000-0000-0000-0000-000000000000"]);

  if (profilesError) {
    console.error("floating chat profiles:", profilesError.message);
    return null;
  }
  const profileById = new Map(
    (profileRows ?? []).map((profile) => [String(profile.id), profile] as const),
  );

  const normalChatsWithNames = normalChats.map((chat) => {
    const other = profileById.get(chat.otherName);
    return { ...chat, otherName: profileLabel(other) };
  });

  const dealThreads: DealPreview[] = dealRows.map((deal) => {
    const listingId = String(deal.listing_id ?? "").trim();
    const listing = listingById.get(listingId);
    const dealBidderId = String(deal.bidder_id ?? "").trim();
    const viewerIsSeller = String(deal.seller_id ?? "").trim() === user.id;
    const counterpartId = viewerIsSeller
      ? String(deal.bidder_id ?? "").trim()
      : String(deal.seller_id ?? "").trim();
    const counterpart = profileById.get(counterpartId);
    const group = resolveDealStatusGroup({
      sellerDecision: String(deal.seller_decision ?? "pending"),
      bidderDecision: String(deal.bidder_decision ?? "pending"),
      buyerReceivedCard: deal.buyer_received_card === true,
      sellerReceivedPayment: deal.seller_received_payment === true,
      isCompleted:
        deal.completed_at != null ||
        (deal.buyer_received_card === true && deal.seller_received_payment === true),
    });
    const badge = dealRoomStatusBadge({
      group,
      viewerRole: viewerIsSeller ? "seller" : "buyer",
      isFixedPrice: String(listing?.type ?? "") === "fixed_price",
      sellerDecision: String(deal.seller_decision ?? "pending"),
      bidderDecision: String(deal.bidder_decision ?? "pending"),
      buyerReceivedCard: deal.buyer_received_card === true,
      sellerReceivedPayment: deal.seller_received_payment === true,
      counterpartUsername: counterpart?.username ?? null,
    });
    const myDecision = viewerIsSeller
      ? String(deal.seller_decision ?? "pending")
      : String(deal.bidder_decision ?? "pending");
    const rowMessages = dealMessages.filter((m) => {
      if (String(m.listing_id ?? "").trim() !== listingId) return false;
      if (String(listing?.type ?? "") === "fixed_price") {
        return String(m.deal_id ?? "").trim() === String(deal.id ?? "").trim();
      }
      return true;
    });
    const last = rowMessages[rowMessages.length - 1];
    return {
      kind: "deal",
      id: `deal:${listingId}:${dealBidderId || "auction"}`,
      dealRowId: String(deal.id ?? "").trim(),
      listingId,
      dealBidderId,
      sellerId: String(deal.seller_id ?? "").trim(),
      bidderId: String(deal.bidder_id ?? "").trim(),
      sellerDecision: String(deal.seller_decision ?? "pending"),
      bidderDecision: String(deal.bidder_decision ?? "pending"),
      buyerReceivedCard: deal.buyer_received_card === true,
      sellerReceivedPayment: deal.seller_received_payment === true,
      sortCreatedAt:
        String(deal.created_at ?? "").trim() ||
        String(listing?.created_at ?? "").trim() ||
        null,
      otherName: profileLabel(counterpart),
      listingTitle: String(listing?.title ?? "").trim() || "Annonse",
      listingImageUrl: normalizeListingImageUrls(listing?.image_urls)[0] ?? null,
      listingUrl: `/listings/${listingId}`,
      dealRoomUrl:
        String(listing?.type ?? "") === "fixed_price"
          ? `/my-auctions/${listingId}?buyer=${encodeURIComponent(dealBidderId)}`
          : `/my-auctions/${listingId}`,
      preview: previewText(last?.body),
      when: formatWhen(last?.created_at ?? deal.completed_at),
      statusBadge: group === "deal_fullfort" ? "Solgt" : badge.text,
      statusTone:
        badge.className.includes("red-") ? "action" : badge.className.includes("green-") ? "wait" : "neutral",
      canRespond: myDecision === "pending",
      responderRole: myDecision === "pending" ? (viewerIsSeller ? "seller" : "bidder") : null,
      viewerRole: viewerIsSeller ? "seller" : "buyer",
      unreadCount: 0,
      messages: rowMessages.map((message) => ({
        id: message.id,
        senderId: message.sender_id,
        body: message.body,
        createdAt: message.created_at,
      })),
    };
  });

  const chats: InboxThread[] = [...dealThreads, ...normalChatsWithNames];
  return <FloatingChatBubble chats={chats} currentUserId={user.id} />;
}
