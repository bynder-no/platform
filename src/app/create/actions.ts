"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type CreateListingState = { error: string } | null;

export async function createListing(
  _prev: CreateListingState,
  formData: FormData,
): Promise<CreateListingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priceRaw = String(formData.get("price_nok") ?? "").trim();
  const listingType = String(formData.get("type") ?? "").trim();

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

  const { error } = await supabase.from("listings").insert({
    seller_id: user.id,
    title,
    description,
    price_nok: priceNok,
    image_urls: [],
    status: "draft",
    type: listingType,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}
