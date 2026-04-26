"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function deleteOwnFixedPriceListing(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const listingId = String(formData.get("listing_id") ?? "").trim();
  if (listingId === "") {
    redirect("/profile");
  }

  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select("id, seller_id, type, status")
    .eq("id", listingId)
    .maybeSingle();

  if (
    listingErr ||
    !listing ||
    listing.type !== "fixed_price" ||
    listing.seller_id !== user.id
  ) {
    redirect("/profile");
  }

  // Soft-delete for seller management: move listing out of public visibility.
  const { error: updateErr } = await supabase
    .from("listings")
    .update({ status: "draft" })
    .eq("id", listingId)
    .eq("seller_id", user.id)
    .eq("type", "fixed_price");

  if (updateErr) {
    redirect("/profile");
  }

  revalidatePath("/profile");
  redirect("/profile");
}
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
    .update({ display_name, username })
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
