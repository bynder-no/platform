"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type ReplyToMessageState = { error: string } | null;

export async function replyToMessage(
  _prev: ReplyToMessageState,
  formData: FormData,
): Promise<ReplyToMessageState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const parentMessageId = String(
    formData.get("parent_message_id") ?? "",
  ).trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!parentMessageId) {
    return { error: "Message is required." };
  }

  if (!body) {
    return { error: "Reply cannot be empty." };
  }

  const { data: parent, error: parentError } = await supabase
    .from("messages")
    .select("sender_id, recipient_id, listing_id")
    .eq("id", parentMessageId)
    .maybeSingle();

  if (parentError) {
    return { error: parentError.message };
  }

  if (!parent) {
    return { error: "Could not load that message." };
  }

  const isParticipant =
    parent.sender_id === user.id || parent.recipient_id === user.id;

  if (!isParticipant) {
    return { error: "You cannot reply to this message." };
  }

  const recipientId =
    parent.sender_id === user.id
      ? parent.recipient_id
      : parent.sender_id;

  if (recipientId === user.id) {
    return { error: "You cannot reply to yourself." };
  }

  const { error: insertError } = await supabase.from("messages").insert({
    sender_id: user.id,
    recipient_id: recipientId,
    listing_id: parent.listing_id,
    body,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  redirect("/messages");
}
