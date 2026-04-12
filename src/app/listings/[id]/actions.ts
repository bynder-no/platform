"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type PublishListingState = { error: string } | null;

export async function publishListing(
  _prev: PublishListingState,
  formData: FormData,
): Promise<PublishListingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const listingId = String(formData.get("listing_id") ?? "").trim();
  if (!listingId) {
    return { error: "Listing is required." };
  }

  const { data: updated, error } = await supabase
    .from("listings")
    .update({ status: "active" })
    .eq("id", listingId)
    .eq("seller_id", user.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!updated) {
    return { error: "Cannot publish this listing." };
  }

  redirect(`/listings/${listingId}`);
}
