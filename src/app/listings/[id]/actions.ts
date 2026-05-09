"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { deleteOwnFixedPriceListingById } from "@/lib/fixed-price-delete";

import { ANTI_SNIPE_WINDOW_MS } from "./bid-rules";
import {
  forceDealOpenedOutcomeIfPending,
  isPostAuctionContactQualifiedByHighestBid,
  resolveAndPersistEndedAuctionOutcomeForListing,
} from "./auction-outcome";

type NotificationType =
  | "outbid"
  | "deal_action_required"
  | "seller_bid_received"
  | "fixed_price_offer";

async function createNotification(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  type: NotificationType,
  listingId: string,
  message: string,
  bidderId?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("create_notification", {
    p_user_id: userId,
    p_type: type,
    p_listing_id: listingId,
    p_message: message,
    p_bidder_id: bidderId ?? null,
  });
  if (error) {
    console.error("create_notification:", error.message);
  }
}

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

export async function deleteFixedPriceListing(
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

  console.log("DELETE FIXED PRICE START", { listingId });

  const deleted = await deleteOwnFixedPriceListingById({
    supabase,
    listingId,
    currentUserId: user.id,
  });

  const deletedOrUpdated = deleted;
  console.log("DELETE FIXED PRICE RESULT", { listingId, deletedOrUpdated });

  if (!deleted) {
    return { error: "Could not delete this listing." };
  }

  const returnTo = String(formData.get("return_to") ?? "").trim();
  revalidatePath("/profile");
  revalidatePath("/my-listings");
  revalidatePath("/");
  revalidatePath("/fixed-price");
  revalidatePath("/search");

  if (returnTo === "/profile") {
    redirect("/profile");
  }
  if (returnTo === "/my-listings") {
    redirect("/my-listings");
  }
  redirect("/my-listings");
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

  const returnTo = String(formData.get("return_to") ?? "").trim();
  if (returnTo === "/") {
    revalidatePath("/");
    redirect("/");
  }
  if (returnTo === "/auctions") {
    revalidatePath("/auctions");
    redirect("/auctions");
  }
  const auctionsOffsetMatch = /^\/auctions\?offset=(\d+)$/.exec(returnTo);
  if (auctionsOffsetMatch) {
    const n = Number.parseInt(auctionsOffsetMatch[1], 10);
    if (
      Number.isFinite(n) &&
      n >= 0 &&
      n <= 10_000 &&
      n % 10 === 0
    ) {
      revalidatePath("/auctions");
      redirect(returnTo);
    }
  }
  if (returnTo === "/following") {
    revalidatePath("/following");
    redirect("/following");
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

export type FixedPriceOfferState = { error: string } | null;

export async function submitFixedPriceOffer(
  _prev: FixedPriceOfferState,
  formData: FormData,
): Promise<FixedPriceOfferState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const listingId = String(formData.get("listing_id") ?? "").trim();
  const priceRaw = String(formData.get("offer_price_nok") ?? "").trim();
  const messageBody = String(formData.get("message") ?? "").trim();

  if (listingId === "") {
    return { error: "Annonse mangler." };
  }

  if (!/^\d+$/.test(priceRaw)) {
    return { error: "Bud må være et heltall i NOK." };
  }

  const offerPriceNok = Number(priceRaw);
  if (
    !Number.isSafeInteger(offerPriceNok) ||
    offerPriceNok < 1 ||
    offerPriceNok > 100_000_000
  ) {
    return { error: "Ugyldig budbeløp." };
  }

  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select("id, seller_id, type, status")
    .eq("id", listingId)
    .maybeSingle();

  if (listingErr) {
    console.error("submitFixedPriceOffer listing:", listingErr.message);
    return { error: listingErr.message };
  }

  if (!listing || listing.type !== "fixed_price") {
    return { error: "Kun fastprisannonser kan få bud her." };
  }

  const st = String(listing.status ?? "").trim();
  if (st !== "active" && st !== "public") {
    return { error: "Annonsen er ikke aktiv." };
  }

  if (user.id === listing.seller_id) {
    return { error: "Du kan ikke by på egen annonse." };
  }

  const sellerId = String(listing.seller_id ?? "").trim();
  if (sellerId === "") {
    return { error: "Selger mangler." };
  }

  const { data: existingDeal, error: existingDealErr } = await supabase
    .from("listing_deals")
    .select("id")
    .eq("listing_id", listingId)
    .eq("bidder_id", user.id)
    .maybeSingle();

  if (existingDealErr) {
    console.error("submitFixedPriceOffer listing_deals lookup:", existingDealErr.message);
    return { error: existingDealErr.message };
  }

  let dealId: string;
  if (existingDeal?.id) {
    dealId = String(existingDeal.id);
    const { error: updErr } = await supabase
      .from("listing_deals")
      .update({
        offer_price_nok: offerPriceNok,
      })
      .eq("id", dealId)
      .eq("bidder_id", user.id);
    if (updErr) {
      return { error: updErr.message };
    }
  } else {
    const { data: inserted, error: insertDealErr } = await supabase
      .from("listing_deals")
      .insert({
        listing_id: listingId,
        seller_id: sellerId,
        bidder_id: user.id,
        seller_decision: "pending",
        bidder_decision: "pending",
        offer_price_nok: offerPriceNok,
      })
      .select("id")
      .maybeSingle();

    if (insertDealErr || !inserted?.id) {
      if (insertDealErr) {
        console.error("submitFixedPriceOffer listing_deals insert failed", {
          code: insertDealErr.code,
          message: insertDealErr.message,
          details: insertDealErr.details,
          hint: insertDealErr.hint,
          listingId,
          bidderId: user.id,
        });
      }

      if (
        insertDealErr &&
        (insertDealErr.code === "23505" ||
          insertDealErr.message.toLowerCase().includes("duplicate"))
      ) {
        const { data: raceDeal } = await supabase
          .from("listing_deals")
          .select("id")
          .eq("listing_id", listingId)
          .eq("bidder_id", user.id)
          .maybeSingle();
        if (raceDeal?.id) {
          dealId = String(raceDeal.id);
          await supabase
            .from("listing_deals")
            .update({ offer_price_nok: offerPriceNok })
            .eq("id", dealId);
        } else {
          const detail =
            insertDealErr &&
            typeof insertDealErr === "object" &&
            "details" in insertDealErr &&
            insertDealErr.details
              ? String(insertDealErr.details)
              : "";
          const base = insertDealErr?.message ?? "Kunne ikke lagre bud.";
          return {
            error:
              detail !== ""
                ? `${base} (${detail})`
                : `${base} — sjekk at databasen tillater flere kjøpere (fjern UNIQUE kun på listing_id).`,
          };
        }
      } else {
        return {
          error:
            insertDealErr?.message ??
            "Kunne ikke lagre bud (ukjent årsak).",
        };
      }
    } else {
      dealId = String(inserted.id);
    }
  }

  if (messageBody !== "") {
    const { error: msgErr } = await supabase.from("listing_deal_messages").insert({
      listing_id: listingId,
      deal_id: dealId,
      sender_id: user.id,
      body: messageBody,
    });
    if (msgErr) {
      console.error("submitFixedPriceOffer message:", msgErr.message);
      return { error: msgErr.message };
    }
  }

  await createNotification(
    supabase,
    sellerId,
    "fixed_price_offer",
    listingId,
    "Du har fått et bud på fastprisannonsen din",
    user.id,
  );

  revalidatePath(`/listings/${listingId}`);
  revalidatePath(`/my-auctions/${listingId}`);
  redirect(`/my-auctions/${listingId}`);
}

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
      "title, seller_id, type, status, price_nok, min_bid_increment_nok, auction_starts_at, auction_ends_at",
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
    await resolveAndPersistEndedAuctionOutcomeForListing(supabase, listingId);
    return { error: "Auksjonen er avsluttet." };
  }

  const { data: topBid, error: topBidError } = await supabase
    .from("bids")
    .select("amount_nok, bidder_id")
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
  const previousHighestBidderId =
    topBid?.bidder_id != null ? String(topBid.bidder_id).trim() : "";

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

  const bidAcceptedAtMs = Date.now();
  const remainingMs = endsAtMs - bidAcceptedAtMs;
  if (remainingMs > 0 && remainingMs < ANTI_SNIPE_WINDOW_MS) {
    const { error: snipeError } = await supabase.rpc("extend_auction_anti_snipe", {
      p_listing_id: listingId,
    });

    if (snipeError) {
      return { error: snipeError.message };
    }
  }

  const returnTo = String(formData.get("return_to") ?? "").trim();
  const backToDashboard = returnTo === "/dashboard";

  if (previousHighestBidderId !== "" && previousHighestBidderId !== user.id) {
    const listingTitle = String(listing.title ?? "").trim() || "annonsen";
    await createNotification(
      supabase,
      previousHighestBidderId,
      "outbid",
      listingId,
      `Du er overbydd i ${listingTitle}.`,
    );
  }

  const sellerId = String(listing.seller_id ?? "").trim();
  if (sellerId !== "" && sellerId !== user.id) {
    await createNotification(
      supabase,
      sellerId,
      "seller_bid_received",
      listingId,
      "Noen har bydd på auksjonen din",
    );
  }

  revalidatePath(`/listings/${listingId}`);
  if (backToDashboard) {
    revalidatePath("/dashboard");
    redirect("/dashboard");
  }
  redirect(`/listings/${listingId}`);
}

export type DealDecisionState = { error: string } | null;

export async function setListingDealDecision(
  _prev: DealDecisionState,
  formData: FormData,
): Promise<DealDecisionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const listingId = String(formData.get("listing_id") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const decisionRaw = String(formData.get("decision") ?? "").trim();
  const inboxContext = String(formData.get("inbox_context") ?? "").trim() === "1";

  if (!listingId) {
    return { error: "Annonse mangler." };
  }
  if (role !== "seller" && role !== "bidder") {
    return { error: "Ugyldig rolle." };
  }
  if (decisionRaw !== "deal" && decisionRaw !== "no_deal") {
    return { error: "Ugyldig valg." };
  }
  const decision = decisionRaw as "deal" | "no_deal";

  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select(
      "title, seller_id, type, auction_ends_at, use_reserve_price, reserve_price_nok, contact_threshold_percent, auction_outcome",
    )
    .eq("id", listingId)
    .maybeSingle();

  if (listingErr) {
    return { error: listingErr.message };
  }
  if (!listing) {
    return { error: "Annonsen finnes ikke." };
  }
  if (listing.type !== "auction" && listing.type !== "fixed_price") {
    return { error: "Kun for annonser med deal." };
  }

  if (listing.type === "fixed_price") {
    const dealBidderId = String(formData.get("deal_bidder_id") ?? "").trim();
    if (dealBidderId === "") {
      return { error: "Kjøpers deal mangler." };
    }

    const { data: fixedDeal, error: fixedDealErr } = await supabase
      .from("listing_deals")
      .select("seller_id, bidder_id")
      .eq("listing_id", listingId)
      .eq("bidder_id", dealBidderId)
      .maybeSingle();

    if (fixedDealErr) {
      return { error: fixedDealErr.message };
    }
    if (!fixedDeal) {
      return { error: "Handel finnes ikke." };
    }

    const fixedSellerId = String(fixedDeal.seller_id ?? "").trim();
    const fixedBidderId = String(fixedDeal.bidder_id ?? "").trim();
    if (role === "seller") {
      if (user.id !== fixedSellerId) {
        return { error: "Bare selger kan svare som selger." };
      }
    } else {
      if (user.id !== fixedBidderId) {
        return { error: "Bare kjøper kan svare som kjøper." };
      }
    }

    const patch =
      role === "seller"
        ? { seller_decision: decision }
        : { bidder_decision: decision };
    const { error: fixedUpdateErr } = await supabase
      .from("listing_deals")
      .update(patch)
      .eq("listing_id", listingId)
      .eq("bidder_id", dealBidderId);

    if (fixedUpdateErr) {
      return { error: fixedUpdateErr.message };
    }

    // Fixed-price lifecycle: listing is marked sold only when seller accepts one buyer's deal.
    if (role === "seller" && decision === "deal") {
      const { error: soldUpdateErr } = await supabase
        .from("listings")
        .update({ status: "sold" })
        .eq("id", listingId)
        .eq("seller_id", user.id)
        .eq("type", "fixed_price");
      if (soldUpdateErr) {
        return { error: soldUpdateErr.message };
      }
      await supabase
        .from("listing_deals")
        .update({
          seller_decision: "no_deal",
          bidder_decision: "no_deal",
        })
        .eq("listing_id", listingId)
        .neq("bidder_id", dealBidderId)
        .eq("seller_decision", "pending")
        .eq("bidder_decision", "pending");
    }

    const returnTo = String(formData.get("return_to") ?? "").trim();
    const dealRoomPath = `/my-auctions/${listingId}`;
    revalidatePath(`/listings/${listingId}`);
    revalidatePath("/profile");
    revalidatePath("/my-listings");
    revalidatePath("/");
    revalidatePath("/fixed-price");
    revalidatePath("/search");
    if (inboxContext) {
      revalidatePath(`/my-auctions/${listingId}`);
      return null;
    }
    if (returnTo === dealRoomPath) {
      revalidatePath(dealRoomPath);
      redirect(dealRoomPath);
    }
    redirect(`/listings/${listingId}`);
  }

  const endsAtMs = listing.auction_ends_at
    ? new Date(listing.auction_ends_at).getTime()
    : Number.NaN;
  if (!Number.isFinite(endsAtMs) || Date.now() < endsAtMs) {
    return { error: "Auksjonen er ikke avsluttet." };
  }

  const { data: bidRows, error: bidsErr } = await supabase
    .from("bids")
    .select("amount_nok, created_at, bidder_id")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: true });

  if (bidsErr) {
    return { error: bidsErr.message };
  }

  const bids = bidRows ?? [];
  let highestBidNok = 0;
  let leadingBidRow: { bidder_id: string; amount_nok: unknown; created_at: string | null } | null =
    null;
  for (const b of bids) {
    const n = Number(b.amount_nok);
    if (!Number.isFinite(n)) continue;
    if (!leadingBidRow || n > highestBidNok) {
      highestBidNok = n;
      leadingBidRow = b;
    } else if (n === highestBidNok && leadingBidRow) {
      const tNew = b.created_at ? new Date(b.created_at).getTime() : -1;
      const tOld = leadingBidRow.created_at
        ? new Date(leadingBidRow.created_at).getTime()
        : -1;
      if (tNew > tOld) leadingBidRow = b;
    }
  }

  const hasAuctionBids = bids.length > 0;
  if (!leadingBidRow) {
    return { error: "Ingen vinnerbud funnet." };
  }

  let contactUnlocked = false;
  contactUnlocked = isPostAuctionContactQualifiedByHighestBid(
    listing.use_reserve_price === true,
    listing.reserve_price_nok,
    listing.contact_threshold_percent,
    highestBidNok,
    hasAuctionBids,
  );

  if (!contactUnlocked) {
    return { error: "Kontakt er ikke åpnet." };
  }

  if (role === "seller") {
    if (user.id !== listing.seller_id) {
      return { error: "Bare selger kan svare som selger." };
    }
  } else {
    if (user.id !== leadingBidRow.bidder_id) {
      return { error: "Bare høyeste budgiver kan svare som budgiver." };
    }
  }

  const { data: existingDeal, error: dealSelectErr } = await supabase
    .from("listing_deals")
    .select("listing_id")
    .eq("listing_id", listingId)
    .maybeSingle();

  if (dealSelectErr) {
    return { error: dealSelectErr.message };
  }

  if (!existingDeal) {
    console.log("DEAL FLOW SOURCE OF TRUTH", { listingId, hasDealRow: false });
    const { error: insertErr } = await supabase.from("listing_deals").insert({
      listing_id: listingId,
      seller_decision: "pending",
      bidder_decision: "pending",
    });
    if (
      insertErr &&
      insertErr.code !== "23505" &&
      !insertErr.message.toLowerCase().includes("duplicate")
    ) {
      return { error: insertErr.message };
    }
    console.log("DEAL FLOW SOURCE OF TRUTH", { listingId, hasDealRow: true });
  } else {
    console.log("DEAL FLOW SOURCE OF TRUTH", { listingId, hasDealRow: true });
  }

  const patch =
    role === "seller"
      ? { seller_decision: decision }
      : { bidder_decision: decision };

  const { error: updateErr } = await supabase
    .from("listing_deals")
    .update(patch)
    .eq("listing_id", listingId);

  if (updateErr) {
    return { error: updateErr.message };
  }

  await forceDealOpenedOutcomeIfPending(supabase, listingId);
  await resolveAndPersistEndedAuctionOutcomeForListing(supabase, listingId);

  const { error: dealStatsErr } = await supabase.rpc(
    "apply_listing_deal_transaction_stats",
    { p_listing_id: listingId },
  );
  if (dealStatsErr) {
    console.error(
      "apply_listing_deal_transaction_stats:",
      dealStatsErr.message,
    );
  }

  const { data: dealAfterDecision, error: dealAfterDecisionErr } = await supabase
    .from("listing_deals")
    .select("seller_decision, bidder_decision")
    .eq("listing_id", listingId)
    .maybeSingle();
  if (dealAfterDecisionErr) {
    console.error("listing_deals select:", dealAfterDecisionErr.message);
  } else if (dealAfterDecision) {
    const sellerDecision = String(dealAfterDecision.seller_decision ?? "pending");
    const bidderDecision = String(dealAfterDecision.bidder_decision ?? "pending");
    const sellerId = String(listing.seller_id ?? "").trim();
    const bidderId = String(leadingBidRow.bidder_id ?? "").trim();
    const dealActionMessage = "Motpart har svart på dealen – din tur";

    // Exactly one side has chosen "deal", the other is still "pending".
    // Do not fire for both pending, both deal, or any no_deal resolution.
    if (sellerDecision === "deal" && bidderDecision === "pending") {
      if (bidderId !== "") {
        await createNotification(
          supabase,
          bidderId,
          "deal_action_required",
          listingId,
          dealActionMessage,
        );
      }
    } else if (bidderDecision === "deal" && sellerDecision === "pending") {
      if (sellerId !== "") {
        await createNotification(
          supabase,
          sellerId,
          "deal_action_required",
          listingId,
          dealActionMessage,
        );
      }
    }
  }

  const returnTo = String(formData.get("return_to") ?? "").trim();
  const dealRoomPath = `/my-auctions/${listingId}`;
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/");
  if (inboxContext) {
    revalidatePath(dealRoomPath);
    return null;
  }
  if (returnTo === dealRoomPath) {
    revalidatePath(dealRoomPath);
    redirect(dealRoomPath);
  }
  redirect(`/listings/${listingId}`);
}
