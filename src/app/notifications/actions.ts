"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export async function markNotificationRead(
  notificationId: string,
): Promise<{ ok?: true; error?: string }> {
  const id = typeof notificationId === "string" ? notificationId.trim() : "";
  if (!id) {
    return { error: "Mangler varsel-ID." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Ikke innlogget." };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/notifications");
  revalidatePath("/", "layout");

  return { ok: true };
}
