"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type EditListingState = { error: string } | null;

function parseWholeNumber(
  raw: string,
  label: string,
  min: number,
  max?: number,
): { value: number | null; error: string | null } {
  if (!/^\d+$/.test(raw)) {
    return { value: null, error: `${label} must be a whole number.` };
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    return { value: null, error: `${label} must be a valid whole number.` };
  }
  if (value < min) {
    return { value: null, error: `${label} must be at least ${min}.` };
  }
  if (max != null && value > max) {
    return { value: null, error: `${label} must be at most ${max}.` };
  }

  return { value, error: null };
}

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
  const auctionEndsRaw = String(formData.get("auction_ends_at") ?? "").trim();
  const minBidIncrementRaw = String(
    formData.get("min_bid_increment_nok") ?? "",
  ).trim();
  const reservePriceRaw = String(formData.get("reserve_price_nok") ?? "").trim();
  const contactThresholdRaw = String(
    formData.get("contact_threshold_percent") ?? "",
  ).trim();
  const useReservePrice = formData.get("use_reserve_price") === "on";

  if (!listingId) {
    return { error: "Listing is required." };
  }

  if (!title) {
    return { error: "Title is required." };
  }

  if (listingType !== "fixed_price" && listingType !== "auction") {
    return { error: "Select a valid listing type." };
  }

  const parsedPrice = parseWholeNumber(priceRaw, "Price (NOK)", 5);
  if (parsedPrice.error || parsedPrice.value == null) {
    return { error: parsedPrice.error ?? "Enter a valid price in NOK." };
  }
  const priceNok = parsedPrice.value;

  let auctionEndsAt: string | null = null;
  let minBidIncrementNok: number | null = null;
  let reservePriceNok: number | null = null;
  let contactThresholdPercent: number | null = null;
  let useReserve = false;
  if (listingType === "auction") {
    if (!auctionEndsRaw) {
      return { error: "Auction end date and time is required." };
    }
    const parsedDate = new Date(auctionEndsRaw);
    if (Number.isNaN(parsedDate.getTime())) {
      return { error: "Enter a valid auction end date and time." };
    }
    if (parsedDate.getTime() <= Date.now()) {
      return { error: "Auction end time must be in the future." };
    }
    auctionEndsAt = parsedDate.toISOString();

    const parsedIncrement = parseWholeNumber(
      minBidIncrementRaw,
      "Minimum bid increment (NOK)",
      5,
    );
    if (parsedIncrement.error || parsedIncrement.value == null) {
      return { error: parsedIncrement.error ?? "Minimum bid increment is required." };
    }
    minBidIncrementNok = parsedIncrement.value;

    if (useReservePrice) {
      const parsedReserve = parseWholeNumber(
        reservePriceRaw,
        "Reserve price (NOK)",
        5,
      );
      if (parsedReserve.error || parsedReserve.value == null) {
        return { error: parsedReserve.error ?? "Reserve price is required." };
      }

      const parsedThreshold = parseWholeNumber(
        contactThresholdRaw,
        "Contact threshold percent",
        10,
        70,
      );
      if (parsedThreshold.error || parsedThreshold.value == null) {
        return {
          error:
            parsedThreshold.error ??
            "Contact threshold percent must be between 10 and 70.",
        };
      }

      useReserve = true;
      reservePriceNok = parsedReserve.value;
      contactThresholdPercent = parsedThreshold.value;
    }
  }

  const { data: updated, error } = await supabase
    .from("listings")
    .update({
      title,
      description,
      price_nok: priceNok,
      type: listingType,
      auction_ends_at: auctionEndsAt,
      min_bid_increment_nok: minBidIncrementNok,
      use_reserve_price: useReserve,
      reserve_price_nok: reservePriceNok,
      contact_threshold_percent: contactThresholdPercent,
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
