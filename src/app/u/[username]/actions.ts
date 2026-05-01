"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

function normalizedId(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function followUser(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const followingId = normalizedId(formData.get("followingId"));
  if (!followingId || followingId === user.id) return;

  const { error } = await supabase.from("user_follows").upsert(
    {
      follower_id: user.id,
      following_id: followingId,
    },
    { onConflict: "follower_id,following_id", ignoreDuplicates: true },
  );

  if (error) {
    throw new Error(`Could not follow user: ${error.message}`);
  }

  const username = normalizedId(formData.get("username"));
  if (username) {
    revalidatePath(`/u/${encodeURIComponent(username)}`);
  }
  revalidatePath("/following");
}

export async function unfollowUser(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const followingId = normalizedId(formData.get("followingId"));
  if (!followingId || followingId === user.id) return;

  const { error } = await supabase
    .from("user_follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", followingId);

  if (error) {
    throw new Error(`Could not unfollow user: ${error.message}`);
  }

  const username = normalizedId(formData.get("username"));
  if (username) {
    revalidatePath(`/u/${encodeURIComponent(username)}`);
  }
  revalidatePath("/following");
}

export async function startConversationThread(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const recipientId = normalizedId(formData.get("recipientId"));
  if (!recipientId || recipientId === user.id) {
    return;
  }

  const { data: existingThread, error: existingThreadError } = await supabase
    .from("conversation_threads")
    .select("id")
    .or(
      `and(requester_id.eq.${user.id},recipient_id.eq.${recipientId}),and(requester_id.eq.${recipientId},recipient_id.eq.${user.id})`,
    )
    .maybeSingle();

  if (existingThreadError) {
    throw new Error(`Could not load conversation thread: ${existingThreadError.message}`);
  }

  if (existingThread?.id) {
    redirect(`/messages/${existingThread.id}`);
  }

  const { data: newThread, error: insertError } = await supabase
    .from("conversation_threads")
    .insert({
      requester_id: user.id,
      recipient_id: recipientId,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Could not create conversation thread: ${insertError.message}`);
  }

  const { data: requesterProfile } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", user.id)
    .maybeSingle();
  const requesterLabel =
    String(requesterProfile?.display_name ?? "").trim() ||
    String(requesterProfile?.username ?? "").trim() ||
    "Medlem";

  const { error: notifyError } = await supabase.rpc("create_chat_notification", {
    p_user_id: recipientId,
    p_type: "message_request",
    p_thread_id: newThread.id,
    p_message: `Ny meldingsforespørsel fra ${requesterLabel}`,
  });
  if (notifyError) {
    console.error("create_chat_notification message_request:", notifyError.message);
  }

  redirect(`/messages/${newThread.id}`);
}
