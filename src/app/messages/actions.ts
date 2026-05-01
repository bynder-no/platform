"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type ConversationMessageState =
  | {
      error?: string;
      success?: boolean;
    }
  | null;

export async function sendConversationMessage(
  _prev: ConversationMessageState,
  formData: FormData,
): Promise<ConversationMessageState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const threadId = String(formData.get("thread_id") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!threadId) {
    return { error: "Chat mangler." };
  }

  if (!body) {
    return { error: "Melding kan ikke være tom." };
  }

  const { data: thread, error: threadError } = await supabase
    .from("conversation_threads")
    .select("id, requester_id, recipient_id, status")
    .eq("id", threadId)
    .maybeSingle();

  if (threadError) {
    return { error: threadError.message };
  }

  if (!thread) {
    return { error: "Kunne ikke finne chat." };
  }

  const isParticipant =
    thread.requester_id === user.id || thread.recipient_id === user.id;

  if (!isParticipant) {
    return { error: "Du har ikke tilgang til denne chatten." };
  }

  const canSend =
    thread.status === "accepted" ||
    (thread.status === "pending" && thread.requester_id === user.id);
  if (!canSend) {
    return { error: "Du kan ikke sende melding i denne chatten ennå." };
  }

  const { error: insertError } = await supabase
    .from("conversation_messages")
    .insert({
      thread_id: thread.id,
      sender_id: user.id,
      body,
    });

  if (insertError) {
    return { error: insertError.message };
  }

  const targetUserId =
    thread.requester_id === user.id ? thread.recipient_id : thread.requester_id;
  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", user.id)
    .maybeSingle();
  const senderLabel =
    String(senderProfile?.display_name ?? "").trim() ||
    String(senderProfile?.username ?? "").trim() ||
    "Medlem";
  const chatNotificationType =
    thread.status === "pending" ? "message_request" : "new_message";
  const chatMessage =
    thread.status === "pending"
      ? `${senderLabel} sendte en meldingsforespørsel`
      : `${senderLabel} sendte en ny melding`;

  const { error: notificationError } = await supabase.rpc("create_chat_notification", {
    p_user_id: targetUserId,
    p_type: chatNotificationType,
    p_thread_id: thread.id,
    p_message: chatMessage,
  });
  if (notificationError) {
    console.error("create_chat_notification:", notificationError.message);
  }

  revalidatePath("/messages");
  revalidatePath(`/messages/${thread.id}`);
  revalidatePath("/notifications");
  return { success: true };
}

export async function acceptConversationRequest(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const threadId = String(formData.get("thread_id") ?? "").trim();
  if (!threadId) return;

  const { error } = await supabase
    .from("conversation_threads")
    .update({ status: "accepted" })
    .eq("id", threadId)
    .eq("recipient_id", user.id)
    .eq("status", "pending");

  if (error) {
    throw new Error(`Could not accept chat request: ${error.message}`);
  }

  revalidatePath("/messages");
  revalidatePath(`/messages/${threadId}`);
}

export async function declineConversationRequest(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const threadId = String(formData.get("thread_id") ?? "").trim();
  if (!threadId) return;

  const { error } = await supabase
    .from("conversation_threads")
    .update({ status: "declined" })
    .eq("id", threadId)
    .eq("recipient_id", user.id)
    .eq("status", "pending");

  if (error) {
    throw new Error(`Could not decline chat request: ${error.message}`);
  }

  revalidatePath("/messages");
  revalidatePath(`/messages/${threadId}`);
}
