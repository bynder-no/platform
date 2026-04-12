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

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid bid amount greater than 0." };
  }

  const { data: listing, error: listingFetchError } = await supabase
    .from("listings")
    .select("seller_id, type, status, auction_ends_at")
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

  if (listing.status !== "active") {
    return { error: "Bidding is not open for this listing." };
  }

  if (user.id === listing.seller_id) {
    return { error: "You cannot bid on your own listing." };
  }

  if (!listing.auction_ends_at) {
    return { error: "This auction has no end time." };
  }

  if (new Date(listing.auction_ends_at).getTime() <= Date.now()) {
    return { error: "This auction has ended." };
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

  const highestNok =
    topBid?.amount_nok != null && Number.isFinite(Number(topBid.amount_nok))
      ? Number(topBid.amount_nok)
      : 0;

  if (highestNok > 0 && amount <= highestNok) {
    return {
      error: "Your bid must be higher than the current highest bid.",
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

  redirect(`/listings/${listingId}`);
}
