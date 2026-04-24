import { createClient } from "@/lib/supabase/server";
import { notifyPostAuctionOutcomeIfResolved } from "@/lib/post-auction-outcome-notifications";
import { resolveAndPersistEndedAuctionOutcomeForListing } from "@/app/listings/[id]/auction-outcome";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function resolveSingleEndedAuction(
  supabase: SupabaseServerClient,
  listingId: string,
): Promise<void> {
  const decision = await resolveAndPersistEndedAuctionOutcomeForListing(
    supabase,
    listingId,
  );
  if (decision != null) {
    await notifyPostAuctionOutcomeIfResolved(supabase, listingId);
  }
}

export async function resolvePendingEndedAuctions(
  supabase: SupabaseServerClient,
  limit = 50,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { data: pendingRows, error: pendingErr } = await supabase
    .from("listings")
    .select("id")
    .eq("type", "auction")
    .eq("auction_outcome", "pending")
    .not("auction_ends_at", "is", null)
    .lte("auction_ends_at", nowIso)
    .order("auction_ends_at", { ascending: true })
    .limit(limit);
  if (pendingErr) {
    console.error("resolve_pending ended listings lookup:", pendingErr.message);
    return;
  }

  const listingIds = (pendingRows ?? [])
    .map((row) => (typeof row.id === "string" ? row.id.trim() : ""))
    .filter((id) => id !== "");

  for (const listingId of listingIds) {
    const decision = await resolveAndPersistEndedAuctionOutcomeForListing(
      supabase,
      listingId,
    );
    if (decision == null) continue;

    const notifyResult = await notifyPostAuctionOutcomeIfResolved(
      supabase,
      listingId,
    );
    if (!notifyResult.ok) {
      console.error("POST AUCTION NOTIFY ERROR", {
        listingId,
        outcome: decision.nextOutcome,
        message: notifyResult.message,
      });
    }
  }
}
