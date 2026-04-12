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
  const auctionEndsRaw = String(formData.get("auction_ends_at") ?? "").trim();

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

  let auctionEndsAt: string | null = null;
  if (listingType === "auction") {
    if (!auctionEndsRaw) {
      return { error: "Auction end date and time is required." };
    }
    const parsed = new Date(auctionEndsRaw);
    if (Number.isNaN(parsed.getTime())) {
      return { error: "Enter a valid auction end date and time." };
    }
    if (parsed.getTime() <= Date.now()) {
      return { error: "Auction end time must be in the future." };
    }
    auctionEndsAt = parsed.toISOString();
  }

  const { error } = await supabase.from("listings").insert({
    seller_id: user.id,
    title,
    description,
    price_nok: priceNok,
    image_urls: [],
    status: "draft",
    type: listingType,
    auction_ends_at: auctionEndsAt,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}
