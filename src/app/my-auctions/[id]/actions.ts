"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type DealChatState = { error: string } | null;

type BidRow = {
  amount_nok: number | string | null;
  created_at: string | null;
  bidder_id: string;
};

function leadingBidderId(bids: BidRow[]): string | null {
  let highestNok = 0;
  let leading: BidRow | null = null;
  for (const b of bids) {
    const n = Number(b.amount_nok);
    if (!Number.isFinite(n)) continue;
    if (!leading || n > highestNok) {
      highestNok = n;
      leading = b;
    } else if (n === highestNok && leading) {
      const tNew = b.created_at ? new Date(b.created_at).getTime() : -1;
      const tOld = leading.created_at
        ? new Date(leading.created_at).getTime()
        : -1;
      if (tNew > tOld) leading = b;
    }
  }
  return leading?.bidder_id ?? null;
}

async function sendCompletionNotification(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listingId: string,
  notifiedUserId: string,
  message: string,
  actorRole: "buyer" | "seller",
  event: "buyer_received_card" | "seller_received_payment",
): Promise<void> {
  const { error } = await supabase.rpc("create_notification", {
    p_user_id: notifiedUserId,
    p_type: "deal_action_required",
    p_listing_id: listingId,
    p_message: message,
  });
  if (error) {
    console.error("deal completion notification failed", {
      listingId,
      notifiedUserId,
      actorRole,
      event,
      message: error.message,
    });
    return;
  }
}

async function sendRatingNotification(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listingId: string,
  ratedUserId: string,
  actorRole: "buyer" | "seller",
): Promise<void> {
  const message =
    actorRole === "buyer" ? "Kjøper har ratet deg" : "Selger har ratet deg";
  const { error } = await supabase.rpc("create_notification", {
    p_user_id: ratedUserId,
    p_type: "deal_action_required",
    p_listing_id: listingId,
    p_message: message,
  });
  if (error) {
    console.error("deal rating notification failed", {
      listingId,
      ratedUserId,
      actorRole,
      message: error.message,
    });
    return;
  }
}

async function maybeSetDealCompletedAt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listingId: string,
): Promise<void> {
  const { data: row, error: selErr } = await supabase
    .from("listing_deals")
    .select("buyer_received_card, seller_received_payment, completed_at")
    .eq("listing_id", listingId)
    .maybeSingle();

  if (selErr || !row) {
    return;
  }
  if (
    row.buyer_received_card !== true ||
    row.seller_received_payment !== true ||
    row.completed_at != null
  ) {
    return;
  }

  const completedAt = new Date().toISOString();
  await supabase
    .from("listing_deals")
    .update({ completed_at: completedAt })
    .eq("listing_id", listingId)
    .is("completed_at", null);
}

export async function sendListingDealMessage(
  _prev: DealChatState,
  formData: FormData,
): Promise<DealChatState> {
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
    return { error: "Annonse mangler." };
  }

  if (!body) {
    return { error: "Meldingen kan ikke være tom." };
  }

  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select("seller_id, type, auction_ends_at")
    .eq("id", listingId)
    .maybeSingle();

  if (listingErr) {
    return { error: listingErr.message };
  }
  if (
    !listing ||
    (listing.type !== "auction" && listing.type !== "fixed_price")
  ) {
    return { error: "Annonsen finnes ikke." };
  }

  if (listing.type === "auction") {
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

    const bids = (bidRows ?? []) as BidRow[];
    const leaderId = leadingBidderId(bids);
    const isSeller = user.id === listing.seller_id;
    const isLeader = leaderId != null && user.id === leaderId;

    if (!isSeller && !isLeader) {
      return { error: "Ingen tilgang." };
    }
  } else {
    const { data: dealRow, error: dealRowErr } = await supabase
      .from("listing_deals")
      .select("seller_id, bidder_id")
      .eq("listing_id", listingId)
      .maybeSingle();
    if (dealRowErr) {
      return { error: dealRowErr.message };
    }
    if (!dealRow) {
      return { error: "Handel finnes ikke." };
    }
    const sellerId = String(dealRow.seller_id ?? "").trim();
    const bidderId = String(dealRow.bidder_id ?? "").trim();
    if (user.id !== sellerId && user.id !== bidderId) {
      return { error: "Ingen tilgang." };
    }
  }

  const { error: insertErr } = await supabase
    .from("listing_deal_messages")
    .insert({
      listing_id: listingId,
      sender_id: user.id,
      body,
    });

  if (insertErr) {
    return { error: insertErr.message };
  }

  revalidatePath(`/my-auctions/${listingId}`);
  redirect(`/my-auctions/${listingId}`);
}

export type ReceivedCardState = { error: string } | null;

export async function markBuyerReceivedCard(
  _prev: ReceivedCardState,
  formData: FormData,
): Promise<ReceivedCardState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const listingId = String(formData.get("listing_id") ?? "").trim();
  if (!listingId) {
    return { error: "Annonse mangler." };
  }

  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select("seller_id, type, auction_ends_at")
    .eq("id", listingId)
    .maybeSingle();

  if (listingErr) {
    return { error: listingErr.message };
  }
  if (!listing || (listing.type !== "auction" && listing.type !== "fixed_price")) {
    return { error: "Annonsen finnes ikke." };
  }

  if (listing.type === "fixed_price") {
    const { data: deal, error: dealErr } = await supabase
      .from("listing_deals")
      .select(
        "seller_id, bidder_id, seller_decision, bidder_decision, buyer_received_card",
      )
      .eq("listing_id", listingId)
      .maybeSingle();
    if (dealErr) {
      return { error: dealErr.message };
    }
    if (!deal) {
      return { error: "Handel finnes ikke." };
    }
    const bidderId = String(deal.bidder_id ?? "").trim();
    if (bidderId === "" || user.id !== bidderId) {
      return { error: "Bare kjøper kan gjøre dette." };
    }
    if (deal.seller_decision !== "deal" || deal.bidder_decision !== "deal") {
      return { error: "Handelen er ikke godkjent av begge parter." };
    }
    if (deal.buyer_received_card === true) {
      return { error: "Allerede registrert." };
    }
    const { error: updErr } = await supabase
      .from("listing_deals")
      .update({
        buyer_received_card: true,
      })
      .eq("listing_id", listingId)
      .eq("seller_decision", "deal")
      .eq("bidder_decision", "deal")
      .eq("buyer_received_card", false);
    if (updErr) {
      return { error: updErr.message };
    }

    const sellerId = String(deal.seller_id ?? "").trim();
    if (sellerId !== "" && sellerId !== user.id) {
      await sendCompletionNotification(
        supabase,
        listingId,
        sellerId,
        "Kjøper har mottatt pakken",
        "buyer",
        "buyer_received_card",
      );
    }

    await maybeSetDealCompletedAt(supabase, listingId);
    revalidatePath(`/my-auctions/${listingId}`);
    redirect(`/my-auctions/${listingId}`);
  }

  const endsAtMs = listing.auction_ends_at
    ? new Date(listing.auction_ends_at).getTime()
    : Number.NaN;
  const now = new Date();
  const nowMs = now.getTime();
  if (!Number.isFinite(endsAtMs) || nowMs < endsAtMs) {
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

  const bids = (bidRows ?? []) as BidRow[];
  const leaderId = leadingBidderId(bids);
  if (leaderId == null || user.id !== leaderId) {
    return { error: "Bare høyeste budgiver kan gjøre dette." };
  }

  const { data: deal, error: dealErr } = await supabase
    .from("listing_deals")
    .select("seller_decision, bidder_decision, buyer_received_card")
    .eq("listing_id", listingId)
    .maybeSingle();

  if (dealErr) {
    return { error: dealErr.message };
  }
  if (!deal) {
    return { error: "Handel finnes ikke." };
  }
  if (deal.seller_decision !== "deal" || deal.bidder_decision !== "deal") {
    return { error: "Handelen er ikke godkjent av begge parter." };
  }
  if (deal.buyer_received_card === true) {
    return { error: "Allerede registrert." };
  }

  const { error: updErr } = await supabase
    .from("listing_deals")
    .update({
      buyer_received_card: true,
    })
    .eq("listing_id", listingId)
    .eq("seller_decision", "deal")
    .eq("bidder_decision", "deal")
    .eq("buyer_received_card", false);

  if (updErr) {
    return { error: updErr.message };
  }

  const sellerId = String(listing.seller_id ?? "").trim();
  if (sellerId !== "" && sellerId !== user.id) {
    await sendCompletionNotification(
      supabase,
      listingId,
      sellerId,
      "Kjøper har mottatt pakken",
      "buyer",
      "buyer_received_card",
    );
  }

  await maybeSetDealCompletedAt(supabase, listingId);

  revalidatePath(`/my-auctions/${listingId}`);
  redirect(`/my-auctions/${listingId}`);
}

export type SellerPaymentState = { error: string } | null;

export async function markSellerReceivedPayment(
  _prev: SellerPaymentState,
  formData: FormData,
): Promise<SellerPaymentState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const listingId = String(formData.get("listing_id") ?? "").trim();
  if (!listingId) {
    return { error: "Annonse mangler." };
  }

  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select("seller_id, type, auction_ends_at")
    .eq("id", listingId)
    .maybeSingle();

  if (listingErr) {
    return { error: listingErr.message };
  }
  if (!listing || (listing.type !== "auction" && listing.type !== "fixed_price")) {
    return { error: "Annonsen finnes ikke." };
  }

  if (listing.type === "fixed_price") {
    const { data: deal, error: dealErr } = await supabase
      .from("listing_deals")
      .select(
        "seller_id, bidder_id, seller_decision, bidder_decision, seller_received_payment",
      )
      .eq("listing_id", listingId)
      .maybeSingle();
    if (dealErr) {
      return { error: dealErr.message };
    }
    if (!deal) {
      return { error: "Handel finnes ikke." };
    }
    const sellerId = String(deal.seller_id ?? "").trim();
    if (sellerId === "" || user.id !== sellerId) {
      return { error: "Bare selger kan gjøre dette." };
    }
    if (deal.seller_decision !== "deal" || deal.bidder_decision !== "deal") {
      return { error: "Handelen er ikke godkjent av begge parter." };
    }
    if (deal.seller_received_payment === true) {
      return { error: "Allerede registrert." };
    }
    const { error: updErr } = await supabase
      .from("listing_deals")
      .update({
        seller_received_payment: true,
      })
      .eq("listing_id", listingId)
      .eq("seller_decision", "deal")
      .eq("bidder_decision", "deal")
      .eq("seller_received_payment", false);
    if (updErr) {
      return { error: updErr.message };
    }

    const bidderId = String(deal.bidder_id ?? "").trim();
    if (bidderId !== "" && bidderId !== user.id) {
      await sendCompletionNotification(
        supabase,
        listingId,
        bidderId,
        "Selger har mottatt betalingen",
        "seller",
        "seller_received_payment",
      );
    }

    await maybeSetDealCompletedAt(supabase, listingId);
    revalidatePath(`/my-auctions/${listingId}`);
    redirect(`/my-auctions/${listingId}`);
  }

  if (user.id !== listing.seller_id) {
    return { error: "Bare selger kan gjøre dette." };
  }

  const endsAtMs = listing.auction_ends_at
    ? new Date(listing.auction_ends_at).getTime()
    : Number.NaN;
  const now = new Date();
  const nowMs = now.getTime();
  if (!Number.isFinite(endsAtMs) || nowMs < endsAtMs) {
    return { error: "Auksjonen er ikke avsluttet." };
  }

  const { data: deal, error: dealErr } = await supabase
    .from("listing_deals")
    .select("seller_decision, bidder_decision, seller_received_payment, bidder_id")
    .eq("listing_id", listingId)
    .maybeSingle();

  if (dealErr) {
    return { error: dealErr.message };
  }
  if (!deal) {
    return { error: "Handel finnes ikke." };
  }
  if (deal.seller_decision !== "deal" || deal.bidder_decision !== "deal") {
    return { error: "Handelen er ikke godkjent av begge parter." };
  }
  if (deal.seller_received_payment === true) {
    return { error: "Allerede registrert." };
  }

  const { error: updErr } = await supabase
    .from("listing_deals")
    .update({
      seller_received_payment: true,
    })
    .eq("listing_id", listingId)
    .eq("seller_decision", "deal")
    .eq("bidder_decision", "deal")
    .eq("seller_received_payment", false);

  if (updErr) {
    return { error: updErr.message };
  }

  const bidderId = String(deal.bidder_id ?? "").trim();
  if (bidderId !== "" && bidderId !== user.id) {
    await sendCompletionNotification(
      supabase,
      listingId,
      bidderId,
      "Selger har mottatt betalingen",
      "seller",
      "seller_received_payment",
    );
  }

  await maybeSetDealCompletedAt(supabase, listingId);

  revalidatePath(`/my-auctions/${listingId}`);
  redirect(`/my-auctions/${listingId}`);
}

export type DealRatingState = { error: string } | null;

export async function submitDealRating(
  _prev: DealRatingState,
  formData: FormData,
): Promise<DealRatingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const listingId = String(formData.get("listing_id") ?? "").trim();
  if (!listingId) {
    return { error: "Annonse mangler." };
  }

  const scoreRaw = formData.get("score");
  const scoreStr = String(scoreRaw ?? "").trim();
  if (!/^[1-5]$/.test(scoreStr)) {
    return { error: "Velg en poengsum fra 1 til 5." };
  }
  const score = Number(scoreStr);

  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select("seller_id, type, auction_ends_at")
    .eq("id", listingId)
    .maybeSingle();

  if (listingErr) {
    return { error: listingErr.message };
  }
  if (!listing || (listing.type !== "auction" && listing.type !== "fixed_price")) {
    return { error: "Annonsen finnes ikke." };
  }

  const uid = user.id.trim();
  let dealSellerId = "";
  let dealBidderId = "";
  let sellerCanRate = false;
  let buyerCanRate = false;

  if (listing.type === "fixed_price") {
    const { data: deal, error: dealErr } = await supabase
      .from("listing_deals")
      .select(
        "seller_id, bidder_id, seller_decision, bidder_decision, buyer_received_card, seller_received_payment, completed_at",
      )
      .eq("listing_id", listingId)
      .maybeSingle();
    if (dealErr) {
      return { error: dealErr.message };
    }
    if (
      !deal ||
      deal.seller_decision !== "deal" ||
      deal.bidder_decision !== "deal"
    ) {
      return { error: "Handelen er ikke klar for vurdering." };
    }
    dealSellerId = String(deal.seller_id ?? "").trim();
    dealBidderId = String(deal.bidder_id ?? "").trim();
    if (uid !== dealSellerId && uid !== dealBidderId) {
      return { error: "Ingen tilgang." };
    }
    sellerCanRate = uid === dealSellerId && deal.seller_received_payment === true;
    buyerCanRate = uid === dealBidderId && deal.buyer_received_card === true;
  } else {
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

    const bids = (bidRows ?? []) as BidRow[];
    const leaderId = leadingBidderId(bids);
    const listingSellerId = String(listing.seller_id ?? "").trim();
    if (leaderId == null) {
      return { error: "Ingen tilgang." };
    }
    const leaderNorm = String(leaderId).trim();
    const isSeller = uid === listingSellerId;
    const isLeader = uid === leaderNorm;
    if (!isSeller && !isLeader) {
      return { error: "Ingen tilgang." };
    }

    const { data: deal, error: dealErr } = await supabase
      .from("listing_deals")
      .select(
        "seller_id, bidder_id, seller_decision, bidder_decision, buyer_received_card, seller_received_payment, completed_at",
      )
      .eq("listing_id", listingId)
      .maybeSingle();

    if (dealErr) {
      return { error: dealErr.message };
    }
    if (
      !deal ||
      deal.seller_decision !== "deal" ||
      deal.bidder_decision !== "deal"
    ) {
      return { error: "Handelen er ikke klar for vurdering." };
    }

    dealSellerId = String(deal.seller_id ?? "").trim();
    dealBidderId = String(deal.bidder_id ?? "").trim();
    if (dealSellerId !== listingSellerId || dealBidderId !== leaderNorm) {
      return { error: "Ingen tilgang." };
    }
    if (uid !== dealSellerId && uid !== dealBidderId) {
      return { error: "Ingen tilgang." };
    }

    sellerCanRate = uid === dealSellerId && deal.seller_received_payment === true;
    buyerCanRate = uid === dealBidderId && deal.buyer_received_card === true;
  }

  if (!sellerCanRate && !buyerCanRate) {
    return { error: "Handelen er ikke klar for vurdering." };
  }

  const { data: existingRating, error: existingErr } = await supabase
    .from("deal_ratings")
    .select("id")
    .eq("listing_id", listingId)
    .eq("from_user_id", user.id)
    .maybeSingle();

  if (existingErr) {
    return { error: existingErr.message };
  }
  if (existingRating) {
    return { error: "Du har allerede ratet denne handelen." };
  }

  const toUserId = uid === dealSellerId ? dealBidderId : dealSellerId;

  const { error: insertErr } = await supabase.from("deal_ratings").insert({
    listing_id: listingId,
    from_user_id: user.id,
    to_user_id: toUserId,
    score,
  });

  if (insertErr) {
    if (
      insertErr.code === "23505" ||
      insertErr.message.toLowerCase().includes("duplicate")
    ) {
      return { error: "Du har allerede ratet denne handelen." };
    }
    return { error: insertErr.message };
  }

  if (toUserId !== "") {
    const actorRole: "buyer" | "seller" = uid === dealBidderId ? "buyer" : "seller";
    await sendRatingNotification(supabase, listingId, toUserId, actorRole);
  }

  revalidatePath(`/my-auctions/${listingId}`);
  redirect(`/my-auctions/${listingId}`);
}
