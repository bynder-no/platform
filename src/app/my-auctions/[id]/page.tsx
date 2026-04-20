import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AuctionDealPanel } from "@/app/listings/[id]/auction-deal-panel";
import { SignedInNavLinks } from "@/components/signed-in-nav-links";
import { BuyerReceivedCardForm } from "./buyer-received-card-form";
import { DealRatingForm } from "./deal-rating-form";
import { DealChatForm } from "./deal-chat-form";
import { DealMessagesPanel } from "./deal-messages-panel";
import { postDealFulfillmentStatusText } from "./deal-status";
import { SellerReceivedPaymentForm } from "./seller-received-payment-form";
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

/** Only literal `true` counts — avoids `Boolean("f")` / other truthy non-booleans. */
function isPgBoolTrue(value: unknown): boolean {
  return value === true;
}

function normalizeCompletedAtIso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : value.toISOString();
  }
  const s = String(value).trim();
  if (s === "" || s.toLowerCase() === "null") return null;
  return s;
}

function dealVenterActionHint(
  viewerRole: "seller" | "bidder",
  deal: { seller_decision: string; bidder_decision: string },
): string {
  const s = deal.seller_decision ?? "pending";
  const b = deal.bidder_decision ?? "pending";
  const mine = viewerRole === "seller" ? s : b;
  const theirs = viewerRole === "seller" ? b : s;
  if (mine === "pending") return "Gi ditt svar";
  if (theirs === "pending") return "Venter på svar fra motpart";
  return "Venter på svar fra motpart";
}

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

  const sellerIdNormalized = String(listing.seller_id ?? "").trim();
  const isSeller = user.id === sellerIdNormalized;
  const isLeadingBidder =
    leadingBidRow != null &&
    user.id === String(leadingBidRow.bidder_id ?? "").trim();

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

  const counterpartUserId = isSeller
    ? winningBidderIdForDeal
    : listingSellerIdForDeal;
  let counterpartUsername: string | null = null;
  if (counterpartUserId !== "") {
    const { data: counterpartProfile, error: counterpartErr } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", counterpartUserId)
      .maybeSingle();
    if (counterpartErr) {
      console.error("profiles:", counterpartErr.message);
    } else {
      const normalizedUsername = String(counterpartProfile?.username ?? "").trim();
      counterpartUsername = normalizedUsername !== "" ? normalizedUsername : null;
    }
  }

  let dealRow: {
    seller_decision: string;
    bidder_decision: string;
    buyer_received_card: boolean;
    seller_received_payment: boolean;
    completed_at: string | null;
  } | null = null;
  if (eligibleForAuctionDeal) {
    const { data: existingDeal, error: dealLoadErr } = await supabase
      .from("listing_deals")
      .select(
        "seller_decision, bidder_decision, buyer_received_card, seller_received_payment, completed_at",
      )
      .eq("listing_id", id)
      .maybeSingle();

    if (dealLoadErr) {
      console.error("listing_deals:", dealLoadErr.message);
    } else if (existingDeal) {
      dealRow = {
        seller_decision: existingDeal.seller_decision,
        bidder_decision: existingDeal.bidder_decision,
        buyer_received_card: isPgBoolTrue(existingDeal.buyer_received_card),
        seller_received_payment: isPgBoolTrue(
          existingDeal.seller_received_payment,
        ),
        completed_at: normalizeCompletedAtIso(existingDeal.completed_at),
      };
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
        .select(
          "seller_decision, bidder_decision, buyer_received_card, seller_received_payment, completed_at",
        )
        .maybeSingle();

      if (insertDealErr) {
        const dup =
          insertDealErr.code === "23505" ||
          insertDealErr.message.toLowerCase().includes("duplicate");
        if (dup) {
          const { data: raceDeal } = await supabase
            .from("listing_deals")
            .select(
              "seller_decision, bidder_decision, buyer_received_card, seller_received_payment, completed_at",
            )
            .eq("listing_id", id)
            .maybeSingle();
          dealRow = raceDeal
            ? {
                seller_decision: raceDeal.seller_decision,
                bidder_decision: raceDeal.bidder_decision,
                buyer_received_card: isPgBoolTrue(
                  raceDeal.buyer_received_card,
                ),
                seller_received_payment: isPgBoolTrue(
                  raceDeal.seller_received_payment,
                ),
                completed_at: normalizeCompletedAtIso(raceDeal.completed_at),
              }
            : null;
        } else {
          console.error("listing_deals insert:", insertDealErr.message);
        }
      } else if (insertedDeal) {
        dealRow = {
          seller_decision: insertedDeal.seller_decision,
          bidder_decision: insertedDeal.bidder_decision,
          buyer_received_card: isPgBoolTrue(
            insertedDeal.buyer_received_card,
          ),
          seller_received_payment: isPgBoolTrue(
            insertedDeal.seller_received_payment,
          ),
          completed_at: normalizeCompletedAtIso(insertedDeal.completed_at),
        };
      }
    }
  }

  const showReceivedCardButton =
    eligibleForAuctionDeal &&
    dealRow != null &&
    isLeadingBidder &&
    dealRow.seller_decision === "deal" &&
    dealRow.bidder_decision === "deal" &&
    dealRow.buyer_received_card === false;

  const showSellerPaymentButton =
    eligibleForAuctionDeal &&
    dealRow != null &&
    isSeller &&
    dealRow.seller_decision === "deal" &&
    dealRow.bidder_decision === "deal" &&
    dealRow.seller_received_payment === false;

  const showDealCompletedMessage =
    eligibleForAuctionDeal &&
    dealRow != null &&
    dealRow.buyer_received_card === true &&
    dealRow.seller_received_payment === true;

  const canBuyerRate =
    eligibleForAuctionDeal &&
    dealRow != null &&
    isLeadingBidder &&
    dealRow.seller_decision === "deal" &&
    dealRow.bidder_decision === "deal" &&
    dealRow.buyer_received_card === true;

  const canSellerRate =
    eligibleForAuctionDeal &&
    dealRow != null &&
    isSeller &&
    dealRow.seller_decision === "deal" &&
    dealRow.bidder_decision === "deal" &&
    dealRow.seller_received_payment === true;

  const showRatingCta = canBuyerRate || canSellerRate;

  const ratingFieldsetLegend = isSeller ? "Rate kjøper" : "Rate selger";
  const ratingHelperText = isSeller
    ? "Handelen er fullført. Du kan nå rate kjøper."
    : "Handelen er fullført. Du kan nå rate selger.";

  let userHasRatedThisDeal = false;
  if (showRatingCta) {
    const { data: myRatingRow, error: myRatingErr } = await supabase
      .from("deal_ratings")
      .select("id")
      .eq("listing_id", id)
      .eq("from_user_id", user.id)
      .maybeSingle();
    if (myRatingErr) {
      console.error("deal_ratings:", myRatingErr.message);
    } else {
      userHasRatedThisDeal = myRatingRow != null;
    }
  }

  const handelOutcomeOverride =
    eligibleForAuctionDeal &&
    dealRow &&
    dealRow.seller_decision !== "no_deal" &&
    dealRow.bidder_decision !== "no_deal" &&
    !(dealRow.seller_decision === "deal" && dealRow.bidder_decision === "deal")
      ? dealVenterActionHint(isSeller ? "seller" : "bidder", dealRow)
      : undefined;

  const topStatusLabel =
    eligibleForAuctionDeal &&
    dealRow != null &&
    dealRow.seller_decision === "deal" &&
    dealRow.bidder_decision === "deal"
      ? showDealCompletedMessage
        ? "Fullført"
        : "Deal bekreftet"
      : "Deal venter";

  const topStatusHelperText =
    topStatusLabel === "Fullført"
      ? "Begge parter har bekreftet handelen."
      : topStatusLabel === "Deal bekreftet"
        ? postDealFulfillmentStatusText(
            isSeller ? "seller" : "bidder",
            dealRow?.seller_decision ?? "pending",
            dealRow?.bidder_decision ?? "pending",
            dealRow?.buyer_received_card ?? false,
            dealRow?.seller_received_payment ?? false,
          ) || "Deal er bekreftet. Følg neste steg for å fullføre."
        : dealRow
          ? dealVenterActionHint(isSeller ? "seller" : "bidder", dealRow)
          : "Venter på at begge svarer på deal.";

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <p className="text-sm">
          <Link
            href="/my-auctions"
            className="font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
          >
            ← Mine deals
          </Link>
        </p>
        <h1 className={pageTitleClass}>Dealrom</h1>
        <SignedInNavLinks />
      </header>

      <div className={`${pageBodyGapClass} space-y-8 text-sm`}>
        <section aria-labelledby="dealroom-summary-heading">
          <h2 id="dealroom-summary-heading" className={sectionLabelClass}>
            Dealoversikt
          </h2>
          <div className="mt-2 rounded-md border border-zinc-200 p-4 dark:border-zinc-700">
            <p className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              {listing.title?.trim() || "—"}
            </p>
            <p className="mt-2 text-zinc-700 dark:text-zinc-300">
              Motpart:{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {counterpartUsername ?? "—"}
              </span>
            </p>
            <p className="mt-1 text-zinc-700 dark:text-zinc-300">
              Du er:{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {isSeller ? "Selger" : "Kjøper"}
              </span>
            </p>
            <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-700">
              <p className={sectionLabelClass}>Status</p>
              <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
                {topStatusLabel}
              </p>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                {topStatusHelperText}
              </p>
            </div>
          </div>
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
              returnToAfterDecision={`/my-auctions/${id}`}
              outcomeTextOverride={handelOutcomeOverride}
              sellerDecision={dealRow.seller_decision}
              bidderDecision={dealRow.bidder_decision}
              showSellerButtons={
                user.id === sellerIdNormalized &&
                dealRow.seller_decision === "pending"
              }
              showBidderButtons={
                leadingBidRow != null &&
                user.id === leadingBidRow.bidder_id &&
                dealRow.bidder_decision === "pending"
              }
            />
            {dealRow.seller_decision === "deal" &&
            dealRow.bidder_decision === "deal"
              ? (() => {
                  const viewer = isSeller ? "seller" : "bidder";
                  const line = postDealFulfillmentStatusText(
                    viewer,
                    dealRow.seller_decision,
                    dealRow.bidder_decision,
                    dealRow.buyer_received_card,
                    dealRow.seller_received_payment,
                  );
                  return line ? (
                    <p className="mt-3 text-zinc-700 dark:text-zinc-300">
                      {line}
                    </p>
                  ) : null;
                })()
              : null}
          </section>
        ) : null}

        {showDealCompletedMessage ? (
          <section aria-labelledby="dealroom-completed-heading">
            <h2
              id="dealroom-completed-heading"
              className={sectionLabelClass}
            >
              Fullført
            </h2>
            <p className="mt-2 text-zinc-700 dark:text-zinc-300">Fullført</p>
          </section>
        ) : (
          <>
            {showReceivedCardButton ? (
              <section aria-labelledby="dealroom-received-card-heading">
                <h2
                  id="dealroom-received-card-heading"
                  className={sectionLabelClass}
                >
                  Kort mottatt
                </h2>
                <BuyerReceivedCardForm listingId={id} />
              </section>
            ) : null}
            {showSellerPaymentButton ? (
              <section aria-labelledby="dealroom-received-payment-heading">
                <h2
                  id="dealroom-received-payment-heading"
                  className={sectionLabelClass}
                >
                  Betaling mottatt
                </h2>
                <SellerReceivedPaymentForm listingId={id} />
              </section>
            ) : null}
          </>
        )}

        {showRatingCta ? (
          <section aria-labelledby="dealroom-rating-heading">
            <h2 id="dealroom-rating-heading" className={sectionLabelClass}>
              Vurdering
            </h2>
            {userHasRatedThisDeal ? (
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                Du har ratet denne handelen.
              </p>
            ) : (
              <DealRatingForm
                listingId={id}
                intro={ratingHelperText}
                fieldsetLegend={ratingFieldsetLegend}
              />
            )}
          </section>
        ) : null}

        <section aria-labelledby="dealroom-chat-heading">
          <h2 id="dealroom-chat-heading" className={sectionLabelClass}>
            Meldinger
          </h2>
          <DealMessagesPanel messages={dealMessages} currentUserId={user.id} />
          <DealChatForm listingId={id} />
        </section>
      </div>
    </div>
  );
}
