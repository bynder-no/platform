import { createClient } from "@/lib/supabase/server";

import { FloatingChatBubble } from "./floating-chat-bubble";

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
};

function profileLabel(
  p:
    | { display_name: string | null; username: string | null }
    | undefined
    | null,
) {
  if (!p) return "Medlem";
  return p.display_name?.trim() || p.username?.trim() || "Medlem";
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
    .order("updated_at", { ascending: false })
    .limit(8);

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
  if (threads.length === 0) {
    return <FloatingChatBubble chats={[]} currentUserId={user.id} />;
  }

  const threadIds = threads.map((thread) => thread.id);
  const profileIds = [
    ...new Set(threads.flatMap((thread) => [thread.requester_id, thread.recipient_id])),
  ];

  const { data: profileRows, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .in("id", profileIds);

  if (profilesError) {
    console.error("floating chat profiles:", profilesError.message);
    return null;
  }

  const profileById = new Map(
    (profileRows ?? []).map((profile) => [String(profile.id), profile] as const),
  );

  const { data: messagesData, error: messagesError } = await supabase
    .from("conversation_messages")
    .select("id, thread_id, sender_id, body, created_at")
    .in("thread_id", threadIds)
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

  const chats = threads.map((thread) => {
    const otherId =
      thread.requester_id === user.id ? thread.recipient_id : thread.requester_id;
    const other = profileById.get(otherId);
    const last = latestByThreadId.get(thread.id);
    return {
      id: thread.id,
      otherName: profileLabel(other),
      preview:
        thread.status === "pending" && thread.requester_id === user.id
          ? "Venter på godkjenning"
          : previewText(last?.body),
      when: formatWhen(last?.created_at ?? thread.updated_at),
      status: thread.status,
      requesterId: thread.requester_id,
      recipientId: thread.recipient_id,
      messages: (messagesByThreadId.get(thread.id) ?? []).map((message) => ({
        id: message.id,
        senderId: message.sender_id,
        body: message.body,
        createdAt: message.created_at,
      })),
    };
  });

  return <FloatingChatBubble chats={chats} currentUserId={user.id} />;
}
