"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { ANTI_SNIPE_WINDOW_MS } from "./bid-rules";

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

export type FavoriteState = { error: string } | null;

export async function toggleFavorite(
  _prev: FavoriteState,
  formData: FormData,
): Promise<FavoriteState> {
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

  const { data: existing, error: fetchError } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("listing_id", listingId)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message };
  }

  if (existing) {
    const { error: deleteError } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("listing_id", listingId);

    if (deleteError) {
      return { error: deleteError.message };
    }
  } else {
    const { error: insertError } = await supabase.from("favorites").insert({
      user_id: user.id,
      listing_id: listingId,
    });

    if (insertError) {
      return { error: insertError.message };
    }
  }

  redirect(`/listings/${listingId}`);
}

export type ContactSellerState = { error: string } | null;

export async function sendListingMessage(
  _prev: ContactSellerState,
  formData: FormData,
): Promise<ContactSellerState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const listingId = String(formData.get("listing_id") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!listingId) {
    return { error: "Listing is required." };
  }

  if (!body) {
    return { error: "Message cannot be empty." };
  }

  const { data: listing, error: listingFetchError } = await supabase
    .from("listings")
    .select("seller_id")
    .eq("id", listingId)
    .maybeSingle();

  if (listingFetchError) {
    return { error: listingFetchError.message };
  }

  if (!listing) {
    return { error: "Listing not found." };
  }

  if (user.id === listing.seller_id) {
    return { error: "You cannot message yourself." };
  }

  const { error: insertError } = await supabase.from("messages").insert({
    sender_id: user.id,
    recipient_id: listing.seller_id,
    listing_id: listingId,
    body,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  redirect(`/listings/${listingId}`);
}

export type PlaceBidState = { error: string } | null;

export async function placeBid(
  _prev: PlaceBidState,
  formData: FormData,
): Promise<PlaceBidState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const listingId = String(formData.get("listing_id") ?? "").trim();
  const amountRaw = String(formData.get("amount_nok") ?? "").trim();

  if (!listingId) {
    return { error: "Listing is required." };
  }

  if (!/^\d+$/.test(amountRaw)) {
    return {
      error: "Bid must be a whole number in NOK (decimals are not allowed).",
    };
  }

  const amount = Number(amountRaw);
  if (!Number.isSafeInteger(amount) || amount < 1) {
    return { error: "Enter a valid whole-number bid in NOK." };
  }

  const { error: publishDueError } = await supabase.rpc("publish_due_auctions");
  if (publishDueError) {
    return { error: publishDueError.message };
  }

  const { data: listing, error: listingFetchError } = await supabase
    .from("listings")
    .select(
      "seller_id, type, status, price_nok, min_bid_increment_nok, auction_starts_at, auction_ends_at",
    )
    .eq("id", listingId)
    .maybeSingle();

  if (listingFetchError) {
    return { error: listingFetchError.message };
  }

  if (!listing) {
    return { error: "Listing not found." };
  }

  if (listing.type !== "auction") {
    return { error: "Bidding is only open for auctions." };
  }

  if (user.id === listing.seller_id) {
    return { error: "You cannot bid on your own listing." };
  }

  if (!listing.auction_starts_at || !listing.auction_ends_at) {
    return { error: "Auction is not open." };
  }

  const startsAtMs = new Date(listing.auction_starts_at).getTime();
  const endsAtMs = new Date(listing.auction_ends_at).getTime();
  if (!Number.isFinite(startsAtMs) || !Number.isFinite(endsAtMs)) {
    return { error: "Auction is not open." };
  }

  const nowMs = Date.now();
  if (nowMs < startsAtMs) {
    return { error: "Auksjonen har ikke startet ennå." };
  }

  if (nowMs >= endsAtMs) {
    return { error: "Auksjonen er avsluttet." };
  }

  const { data: topBid, error: topBidError } = await supabase
    .from("bids")
    .select("amount_nok")
    .eq("listing_id", listingId)
    .order("amount_nok", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (topBidError) {
    return { error: topBidError.message };
  }

  const highestNokRaw =
    topBid?.amount_nok != null && Number.isFinite(Number(topBid.amount_nok))
      ? Math.trunc(Number(topBid.amount_nok))
      : null;

  const startPriceNok =
    listing.price_nok != null && Number.isFinite(Number(listing.price_nok))
      ? Math.trunc(Number(listing.price_nok))
      : null;
  if (startPriceNok == null || startPriceNok < 1) {
    return { error: "Auksjonen mangler gyldig startpris." };
  }

  const minBidIncrementNok =
    listing.min_bid_increment_nok != null &&
    Number.isFinite(Number(listing.min_bid_increment_nok))
      ? Math.trunc(Number(listing.min_bid_increment_nok))
      : null;
  if (minBidIncrementNok == null || minBidIncrementNok < 1) {
    return {
      error:
        "Auksjonen mangler gyldig minste budøkning. Prøv igjen senere eller kontakt support.",
    };
  }

  const minRequired =
    highestNokRaw == null
      ? startPriceNok
      : highestNokRaw + minBidIncrementNok;

  if (amount < minRequired) {
    if (highestNokRaw == null) {
      return {
        error: `Første bud må være minst ${startPriceNok} NOK.`,
      };
    }
    return {
      error: `Budet ditt må være minst ${minRequired} NOK.`,
    };
  }

  const { error: insertError } = await supabase.from("bids").insert({
    listing_id: listingId,
    bidder_id: user.id,
    amount_nok: amount,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  const remainingMs = endsAtMs - Date.now();
  if (remainingMs > 0 && remainingMs < ANTI_SNIPE_WINDOW_MS) {
    const { error: snipeError } = await supabase.rpc("extend_auction_anti_snipe", {
      p_listing_id: listingId,
    });

    if (snipeError) {
      return { error: snipeError.message };
    }
  }

  revalidatePath(`/listings/${listingId}`);
  redirect(`/listings/${listingId}`);
}
