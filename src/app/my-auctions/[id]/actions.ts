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
  if (!listing || listing.type !== "auction") {
    return { error: "Annonsen finnes ikke." };
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

  const bids = (bidRows ?? []) as BidRow[];
  const leaderId = leadingBidderId(bids);
  const isSeller = user.id === listing.seller_id;
  const isLeader = leaderId != null && user.id === leaderId;

  if (!isSeller && !isLeader) {
    return { error: "Ingen tilgang." };
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
