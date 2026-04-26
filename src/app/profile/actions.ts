"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
export type UpdateProfileState = { error: string } | null;

const USERNAME_TAKEN = "That username is already taken.";

export async function updateProfile(
  _prev: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const display_name =
    String(formData.get("display_name") ?? "").trim() || null;

  // Optional; blank clears to null (same as the profile form).
  const usernameRaw = String(formData.get("username") ?? "");
  const username = usernameRaw.trim() || null;
  const shopNameRaw = String(formData.get("shop_name") ?? "");
  const shop_name = shopNameRaw.trim() || null;

  if (username) {
    const { data: other, error: conflictError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .neq("id", user.id)
      .maybeSingle();

    if (conflictError) {
      return { error: conflictError.message };
    }

    if (other) {
      return { error: USERNAME_TAKEN };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name, username, shop_name })
    .eq("id", user.id);

  if (error) {
    if (
      error.code === "23505" ||
      error.message.toLowerCase().includes("duplicate key")
    ) {
      return { error: USERNAME_TAKEN };
    }
    return { error: error.message };
  }

  redirect("/profile");
}
