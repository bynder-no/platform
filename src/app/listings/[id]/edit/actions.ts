"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type EditListingState = { error: string } | null;

export async function updateDraftListing(
  _prev: EditListingState,
  formData: FormData,
): Promise<EditListingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const listingId = String(formData.get("listing_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priceRaw = String(formData.get("price_nok") ?? "").trim();
  const listingType = String(formData.get("type") ?? "").trim();

  if (!listingId) {
    return { error: "Listing is required." };
  }

  if (!title) {
    return { error: "Title is required." };
  }

  if (listingType !== "fixed_price" && listingType !== "auction") {
    return { error: "Select a valid listing type." };
  }

  const priceNok = Number(priceRaw);
  if (!Number.isFinite(priceNok) || priceNok < 0) {
    return { error: "Enter a valid price in NOK (0 or greater)." };
  }

  const { data: updated, error } = await supabase
    .from("listings")
    .update({
      title,
      description,
      price_nok: priceNok,
      type: listingType,
    })
    .eq("id", listingId)
    .eq("seller_id", user.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!updated) {
    return { error: "Could not save changes." };
  }

  redirect(`/listings/${listingId}`);
}
