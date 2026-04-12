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

export type DeleteListingState = { error: string } | null;

export async function deleteDraftListing(
  _prev: DeleteListingState,
  formData: FormData,
): Promise<DeleteListingState> {
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

  const { data: listing, error: fetchError } = await supabase
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .eq("seller_id", user.id)
    .eq("status", "draft")
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }

  if (!listing) {
    return { error: "Could not delete this listing." };
  }

  const { error: deleteError } = await supabase
    .from("listings")
    .delete()
    .eq("id", listingId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  redirect("/dashboard");
}
