import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AuctionDealPanel } from "@/app/listings/[id]/auction-deal-panel";
import { SignedInNavLinks } from "@/components/signed-in-nav-links";
import { DealChatForm } from "./deal-chat-form";
import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

type BidRow = {
  id: string;
  amount_nok: number | string | null;
  created_at: string | null;
  bidder_id: string;
};

const sectionLabelClass =
  "text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

export default async function MyAuctionDealRoomPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error: publishDueError } = await supabase.rpc("publish_due_auctions");
  if (publishDueError) {
    console.error("publish_due_auctions:", publishDueError.message);
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select(
      "title, seller_id, type, auction_ends_at, use_reserve_price, reserve_price_nok, contact_threshold_percent",
    )
    .eq("id", id)
    .maybeSingle();

  if (listingError) {
    throw new Error(`Could not load listing: ${listingError.message}`);
  }

  if (!listing || listing.type !== "auction") {
    notFound();
  }

  const now = new Date();
  const nowMs = now.getTime();
  const endsAtMs = listing.auction_ends_at
    ? new Date(listing.auction_ends_at).getTime()
    : Number.NaN;
  if (!Number.isFinite(endsAtMs) || nowMs < endsAtMs) {
    notFound();
  }

  const { data: bidRows, error: bidsError } = await supabase
    .from("bids")
    .select("id, amount_nok, created_at, bidder_id")
    .eq("listing_id", id)
    .order("created_at", { ascending: true });

  if (bidsError) {
    throw new Error(`Could not load bids: ${bidsError.message}`);
  }

  const auctionBids = (bidRows ?? []) as BidRow[];

  let highestBidNok = 0;
  let leadingBidRow: BidRow | null = null;
  for (const b of auctionBids) {
    const n = Number(b.amount_nok);
    if (!Number.isFinite(n)) continue;
    if (n > highestBidNok) {
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

  const isSeller = user.id === listing.seller_id;
  const isLeadingBidder =
    leadingBidRow != null && user.id === leadingBidRow.bidder_id;

  if (!isSeller && !isLeadingBidder) {
    notFound();
  }

  const { data: dealMessageRows, error: dealMessagesError } = await supabase
    .from("listing_deal_messages")
    .select("id, body, sender_id, created_at")
    .eq("listing_id", id)
    .order("created_at", { ascending: true });

  if (dealMessagesError) {
    throw new Error(`Could not load deal messages: ${dealMessagesError.message}`);
  }

  const dealMessages = dealMessageRows ?? [];

  const hasAuctionBids = auctionBids.length > 0;

  let contactUnlockedPostAuction = false;
  if (!listing.use_reserve_price) {
    contactUnlockedPostAuction = hasAuctionBids;
  } else {
    const reserveNok = listing.reserve_price_nok;
    const pct = listing.contact_threshold_percent;
    if (
      reserveNok != null &&
      pct != null &&
      Number.isFinite(Number(reserveNok)) &&
      Number.isFinite(Number(pct))
    ) {
      const contactOpensAtNok = Math.ceil(
        (Number(reserveNok) * Number(pct)) / 100,
      );
      contactUnlockedPostAuction = highestBidNok >= contactOpensAtNok;
    }
  }

  const auctionEndedContactMessage = !hasAuctionBids
    ? "Ingen bud mottatt"
    : !contactUnlockedPostAuction
      ? "Auksjonen er avsluttet uten åpnet kontakt"
      : "Kontakt er åpnet mellom selger og høyeste budgiver";

  const eligibleForAuctionDeal =
    contactUnlockedPostAuction &&
    leadingBidRow != null &&
    (isSeller || isLeadingBidder);

  const listingIdForDeal =
    typeof id === "string" && id.trim() !== "" ? id.trim() : "";
  const listingSellerIdForDeal =
    listing.seller_id != null && String(listing.seller_id).trim() !== ""
      ? String(listing.seller_id).trim()
      : "";
  const winningBidderIdForDeal =
    leadingBidRow != null &&
    leadingBidRow.bidder_id != null &&
    String(leadingBidRow.bidder_id).trim() !== ""
      ? String(leadingBidRow.bidder_id).trim()
      : "";

  const dealInsertIdsReady =
    listingIdForDeal !== "" &&
    listingSellerIdForDeal !== "" &&
    winningBidderIdForDeal !== "";

  let dealRow: { seller_decision: string; bidder_decision: string } | null =
    null;
  if (eligibleForAuctionDeal) {
    const { data: existingDeal, error: dealLoadErr } = await supabase
      .from("listing_deals")
      .select("seller_decision, bidder_decision")
      .eq("listing_id", id)
      .maybeSingle();

    if (dealLoadErr) {
      console.error("listing_deals:", dealLoadErr.message);
    } else if (existingDeal) {
      dealRow = existingDeal;
    } else if (dealInsertIdsReady) {
      const { data: insertedDeal, error: insertDealErr } = await supabase
        .from("listing_deals")
        .insert({
          listing_id: listingIdForDeal,
          seller_id: listingSellerIdForDeal,
          bidder_id: winningBidderIdForDeal,
          seller_decision: "pending",
          bidder_decision: "pending",
        })
        .select("seller_decision, bidder_decision")
        .maybeSingle();

      if (insertDealErr) {
        const dup =
          insertDealErr.code === "23505" ||
          insertDealErr.message.toLowerCase().includes("duplicate");
        if (dup) {
          const { data: raceDeal } = await supabase
            .from("listing_deals")
            .select("seller_decision, bidder_decision")
            .eq("listing_id", id)
            .maybeSingle();
          dealRow = raceDeal ?? null;
        } else {
          console.error("listing_deals insert:", insertDealErr.message);
        }
      } else {
        dealRow = insertedDeal;
      }
    }
  }

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <p className="text-sm">
          <Link
            href="/my-auctions"
            className="font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
          >
            ← Mine auksjoner
          </Link>
        </p>
        <h1 className={pageTitleClass}>Dealrom</h1>
        <SignedInNavLinks />
      </header>

      <div className={`${pageBodyGapClass} space-y-8 text-sm`}>
        <section aria-labelledby="dealroom-title-heading">
          <h2 id="dealroom-title-heading" className={sectionLabelClass}>
            Annonse
          </h2>
          <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            {listing.title?.trim() || "—"}
          </p>
        </section>

        <section aria-labelledby="dealroom-bid-heading">
          <h2 id="dealroom-bid-heading" className={sectionLabelClass}>
            Høyeste bud
          </h2>
          <p className="mt-2 tabular-nums text-zinc-800 dark:text-zinc-200">
            {highestBidNok > 0 ? highestBidNok : 0}{" "}
            <span className="text-zinc-500 dark:text-zinc-400">NOK</span>
          </p>
        </section>

        <section aria-labelledby="dealroom-ended-heading">
          <h2 id="dealroom-ended-heading" className={sectionLabelClass}>
            Status
          </h2>
          <p className="mt-2 text-zinc-700 dark:text-zinc-300">Avsluttet</p>
        </section>

        <section aria-labelledby="dealroom-contact-heading">
          <h2 id="dealroom-contact-heading" className={sectionLabelClass}>
            Kontakt
          </h2>
          <p className="mt-2 text-zinc-700 dark:text-zinc-300">
            {auctionEndedContactMessage}
          </p>
        </section>

        {eligibleForAuctionDeal && dealRow ? (
          <section aria-labelledby="dealroom-deal-heading">
            <h2 id="dealroom-deal-heading" className={sectionLabelClass}>
              Handel
            </h2>
            <AuctionDealPanel
              listingId={id}
              sellerDecision={dealRow.seller_decision}
              bidderDecision={dealRow.bidder_decision}
              showSellerButtons={
                user.id === listing.seller_id &&
                dealRow.seller_decision === "pending"
              }
              showBidderButtons={
                leadingBidRow != null &&
                user.id === leadingBidRow.bidder_id &&
                dealRow.bidder_decision === "pending"
              }
            />
          </section>
        ) : null}

        <section aria-labelledby="dealroom-chat-heading">
          <h2 id="dealroom-chat-heading" className={sectionLabelClass}>
            Meldinger
          </h2>
          {dealMessages.length === 0 ? (
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Ingen meldinger ennå.
            </p>
          ) : (
            <ul className="mt-3 space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
              {dealMessages.map((m) => {
                const when = m.created_at
                  ? new Date(m.created_at).toLocaleString()
                  : "—";
                const label =
                  m.sender_id === user.id ? "Deg" : "Motpart";
                return (
                  <li key={m.id} className="text-sm">
                    <p className="font-medium text-zinc-800 dark:text-zinc-200">
                      {label}
                      <span className="mx-2 font-normal text-zinc-400 dark:text-zinc-500">
                        ·
                      </span>
                      <span className="font-normal text-zinc-500 dark:text-zinc-400">
                        {when}
                      </span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                      {String(m.body ?? "").trim() || "—"}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          <DealChatForm listingId={id} />
        </section>
      </div>
    </div>
  );
}
