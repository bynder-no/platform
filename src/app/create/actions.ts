"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { parseListingCategory } from "./listing-categories";
import { parseListingType } from "./listing-type";

export type CreateListingState = { error: string } | null;

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

  const category = parseListingCategory(
    String(formData.get("category") ?? "").trim(),
  );
  if (category == null) {
    redirect("/create");
  }

  const listingType = parseListingType(
    String(formData.get("type") ?? "").trim(),
  );
  if (listingType == null) {
    redirect(`/create?category=${encodeURIComponent(category)}`);
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priceRaw = String(formData.get("price_nok") ?? "").trim();
  const auctionStartDateRaw = String(
    formData.get("auction_start_date") ?? "",
  ).trim();
  const auctionStartTimeRaw = String(
    formData.get("auction_start_time") ?? "",
  ).trim();
  const auctionEndDateRaw = String(formData.get("auction_end_date") ?? "").trim();
  const auctionEndTimeRaw = String(formData.get("auction_end_time") ?? "").trim();
  const minBidIncrementRaw = String(
    formData.get("min_bid_increment_nok") ?? "",
  ).trim();
  const reservePriceRaw = String(formData.get("reserve_price_nok") ?? "").trim();
  const contactThresholdRaw = String(
    formData.get("contact_threshold_percent") ?? "",
  ).trim();
  const useReservePrice = formData.get("use_reserve_price") === "on";

  if (!title) {
    return { error: "Title is required." };
  }

  let priceNok: number | null = null;
  if (listingType === "fixed_price") {
    const parsedPrice = parseWholeNumber(priceRaw, "Price (NOK)", 5);
    if (parsedPrice.error || parsedPrice.value == null) {
      return { error: parsedPrice.error ?? "Enter a valid price in NOK." };
    }
    priceNok = parsedPrice.value;
  }

  let auctionStartsAt: string | null = null;
  let auctionEndsAt: string | null = null;
  let minBidIncrementNok: number | null = null;
  let reservePriceNok: number | null = null;
  let contactThresholdPercent: number | null = null;
  let useReserve = false;
  if (listingType === "auction") {
    if (!auctionStartDateRaw || !auctionStartTimeRaw) {
      return { error: "Auction start date and time is required." };
    }
    if (!auctionEndDateRaw || !auctionEndTimeRaw) {
      return { error: "Auction end date and time is required." };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(auctionStartDateRaw)) {
      return { error: "Enter a valid auction start date." };
    }
    if (!/^\d{2}:\d{2}$/.test(auctionStartTimeRaw)) {
      return { error: "Enter a valid auction start time." };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(auctionEndDateRaw)) {
      return { error: "Enter a valid auction end date." };
    }
    if (!/^\d{2}:\d{2}$/.test(auctionEndTimeRaw)) {
      return { error: "Enter a valid auction end time." };
    }
    const parsedStart = new Date(`${auctionStartDateRaw}T${auctionStartTimeRaw}`);
    if (Number.isNaN(parsedStart.getTime())) {
      return { error: "Enter a valid auction start date and time." };
    }
    const parsedEnd = new Date(`${auctionEndDateRaw}T${auctionEndTimeRaw}`);
    if (Number.isNaN(parsedEnd.getTime())) {
      return { error: "Enter a valid auction end date and time." };
    }
    if (parsedStart.getTime() >= parsedEnd.getTime()) {
      return { error: "Auction start time must be before auction end time." };
    }
    auctionStartsAt = parsedStart.toISOString();
    auctionEndsAt = parsedEnd.toISOString();

    const parsedIncrement = parseWholeNumber(
      minBidIncrementRaw,
      "Minimum bid increment (NOK)",
      5,
    );
    if (parsedIncrement.error || parsedIncrement.value == null) {
      return { error: parsedIncrement.error ?? "Minimum bid increment is required." };
    }
    minBidIncrementNok = parsedIncrement.value;
    priceNok = parsedIncrement.value;

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

  const { error } = await supabase.from("listings").insert({
    seller_id: user.id,
    title,
    description,
    category,
    price_nok: priceNok,
    image_urls: [],
    status: listingType === "fixed_price" ? "active" : "draft",
    type: listingType,
    auction_starts_at: auctionStartsAt,
    auction_ends_at: auctionEndsAt,
    min_bid_increment_nok: minBidIncrementNok,
    use_reserve_price: useReserve,
    reserve_price_nok: reservePriceNok,
    contact_threshold_percent: contactThresholdPercent,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}
