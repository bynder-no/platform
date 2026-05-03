import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AuctionDealPanel } from "@/app/listings/[id]/auction-deal-panel";
import { BuyerReceivedCardForm } from "./buyer-received-card-form";
import { DealRatingForm } from "./deal-rating-form";
import { DealChatForm } from "./deal-chat-form";
import { DealMessagesPanel } from "./deal-messages-panel";
import { postDealFulfillmentStatusText } from "./deal-status";
import { SellerReceivedPaymentForm } from "./seller-received-payment-form";
import { normalizeListingImageUrls } from "@/lib/listing-images";
import { createClient } from "@/lib/supabase/server";
import {
  dealCounterpartDisplayName,
  dealStatusDetailText,
  dealStatusGroupLabel,
  dealStatusRespondToCounterpart,
  dealStatusWaitOnCounterpart,
  resolveDealStatusGroup,
} from "../deal-status-ui";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ buyer?: string | string[] }>;
};

type BidRow = {
  id: string;
  amount_nok: number | string | null;
  created_at: string | null;
  bidder_id: string;
};

const sectionLabelClass =
  "text-xs font-semibold uppercase tracking-wide text-zinc-500";

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
  counterpartUsername: string | null | undefined,
): string {
  const s = deal.seller_decision ?? "pending";
  const b = deal.bidder_decision ?? "pending";
  const mine = viewerRole === "seller" ? s : b;
  const theirs = viewerRole === "seller" ? b : s;
  const name = dealCounterpartDisplayName(counterpartUsername);
  if (mine === "pending") return "Gi ditt svar";
  if (theirs === "pending") return `Venter på svar fra ${name}`;
  return `Venter på svar fra ${name}`;
}

/** Display-only; seller-auksjon «Deal venter» neste linje. */
function sellerAuctionDealVenterNextActionLine(
  deal: { seller_decision: string; bidder_decision: string } | null,
  counterpartUsername: string | null | undefined,
): string {
  const s = deal?.seller_decision ?? "pending";
  if (s === "pending") return dealStatusRespondToCounterpart(counterpartUsername);
  return dealStatusWaitOnCounterpart(counterpartUsername);
}

export default async function MyAuctionDealRoomPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const buyerParamRaw =
    typeof sp.buyer === "string"
      ? sp.buyer.trim()
      : Array.isArray(sp.buyer)
        ? String(sp.buyer[0] ?? "").trim()
        : "";
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
      "title, seller_id, type, status, price_nok, image_urls, auction_ends_at, use_reserve_price, reserve_price_nok, contact_threshold_percent",
    )
    .eq("id", id)
    .maybeSingle();

  if (listingError) {
    throw new Error(`Could not load listing: ${listingError.message}`);
  }

  if (!listing || (listing.type !== "auction" && listing.type !== "fixed_price")) {
    notFound();
  }

  if (listing.type === "fixed_price") {
    const { data: dealsForListing, error: dealsForListingErr } = await supabase
      .from("listing_deals")
      .select(
        "id, seller_id, bidder_id, seller_decision, bidder_decision, buyer_received_card, seller_received_payment, completed_at, offer_price_nok",
      )
      .eq("listing_id", id);

    if (dealsForListingErr) {
      throw new Error(
        `Could not load listing deals: ${dealsForListingErr.message}`,
      );
    }

    const dealsList = dealsForListing ?? [];
    if (dealsList.length === 0) {
      notFound();
    }

    const fixedSellerId = String(listing.seller_id ?? "").trim();
    const isFixedSeller = user.id === fixedSellerId;
    const isFixedBuyer = dealsList.some(
      (d) => String(d.bidder_id ?? "").trim() === user.id,
    );

    if (!isFixedSeller && !isFixedBuyer) {
      notFound();
    }

    if (
      isFixedSeller &&
      dealsList.length > 1 &&
      buyerParamRaw === ""
    ) {
      const bidderIds = [
        ...new Set(
          dealsList
            .map((d) => String(d.bidder_id ?? "").trim())
            .filter((x) => x !== ""),
        ),
      ];
      const { data: bidderProfiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", bidderIds);
      const usernameByBidder = new Map<string, string>();
      for (const p of bidderProfiles ?? []) {
        const uid = String(p.id ?? "").trim();
        const un = String(p.username ?? "").trim();
        if (uid !== "") usernameByBidder.set(uid, un || uid);
      }

      return (
        <div className={pageShellClass}>
          <header className={pageHeaderClass}>
            <p className="text-sm">
              <Link
                href="/my-auctions"
                className="font-medium text-zinc-700 underline-offset-2 hover:underline"
              >
                ← Mine deals
              </Link>
            </p>
            <h1 className={pageTitleClass}>Velg kjøper</h1>
            
          </header>
          <div className={`${pageBodyGapClass} space-y-4 text-sm`}>
            <p className="text-zinc-700">
              Flere kjøpere har gitt bud på{" "}
              <span className="font-medium text-zinc-900">
                {listing.title?.trim() || "denne annonsen"}
              </span>
              . Åpne dealrommet for den du vil svare.
            </p>
            <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200">
              {dealsList.map((d) => {
                const bid = String(d.bidder_id ?? "").trim();
                const label =
                  bid !== "" ? usernameByBidder.get(bid) ?? bid : "—";
                const offer =
                  d.offer_price_nok != null &&
                  Number.isFinite(Number(d.offer_price_nok))
                    ? Math.trunc(Number(d.offer_price_nok))
                    : null;
                return (
                  <li
                    key={`${d.id}-${bid}`}
                    className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-zinc-900">
                        {label}
                      </p>
                      {offer != null ? (
                        <p className="text-xs text-zinc-600">
                          Bud:{" "}
                          <span className="tabular-nums font-medium text-zinc-800">
                            {offer} NOK
                          </span>
                        </p>
                      ) : null}
                    </div>
                    <Link
                      href={`/my-auctions/${id}?buyer=${encodeURIComponent(bid)}`}
                      className="inline-flex w-fit shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                    >
                      Gå til deal
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      );
    }

    let fixedDeal = dealsList[0];
    if (isFixedBuyer) {
      const mine = dealsList.find(
        (d) => String(d.bidder_id ?? "").trim() === user.id,
      );
      if (!mine) {
        notFound();
      }
      fixedDeal = mine;
    } else if (isFixedSeller) {
      if (dealsList.length === 1) {
        fixedDeal = dealsList[0];
      } else {
        const match = dealsList.find(
          (d) => String(d.bidder_id ?? "").trim() === buyerParamRaw,
        );
        if (!match) {
          notFound();
        }
        fixedDeal = match;
      }
    }

    const fixedDealRowId = String(fixedDeal.id ?? "").trim();
    const fixedBidderId = String(fixedDeal.bidder_id ?? "").trim();
    const isFixedBuyerResolved = user.id === fixedBidderId;

    const counterpartUserId = isFixedSeller ? fixedBidderId : fixedSellerId;
    let counterpartUsername: string | null = null;
    if (counterpartUserId !== "") {
      const { data: counterpartProfile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", counterpartUserId)
        .maybeSingle();
      const normalizedUsername = String(counterpartProfile?.username ?? "").trim();
      counterpartUsername = normalizedUsername !== "" ? normalizedUsername : null;
    }

    let fixedDealMessagesQuery = supabase
      .from("listing_deal_messages")
      .select("id, body, sender_id, created_at")
      .order("created_at", { ascending: true });

    if (fixedDealRowId !== "") {
      fixedDealMessagesQuery = fixedDealMessagesQuery.eq(
        "deal_id",
        fixedDealRowId,
      );
    } else {
      fixedDealMessagesQuery = fixedDealMessagesQuery.eq("listing_id", id);
    }

    const { data: fixedDealMessageRows, error: fixedDealMessagesError } =
      await fixedDealMessagesQuery;

    if (fixedDealMessagesError) {
      throw new Error(
        `Could not load deal messages: ${fixedDealMessagesError.message}`,
      );
    }

    const fixedDealMessages = fixedDealMessageRows ?? [];
    const sellerDecision = String(fixedDeal.seller_decision ?? "pending");
    const bidderDecision = String(fixedDeal.bidder_decision ?? "pending");
    const buyerReceivedCard = isPgBoolTrue(fixedDeal.buyer_received_card);
    const sellerReceivedPayment = isPgBoolTrue(fixedDeal.seller_received_payment);
    const showFixedSellerButtons =
      isFixedSeller && sellerDecision === "pending";
    const showFixedBuyerButtons =
      isFixedBuyerResolved && bidderDecision === "pending";
    const showFixedReceivedCardButton =
      isFixedBuyerResolved &&
      sellerDecision === "deal" &&
      bidderDecision === "deal" &&
      buyerReceivedCard === false;
    const showFixedSellerPaymentButton =
      isFixedSeller &&
      sellerDecision === "deal" &&
      bidderDecision === "deal" &&
      sellerReceivedPayment === false;
    const showFixedDealCompletedMessage =
      sellerDecision === "deal" &&
      bidderDecision === "deal" &&
      buyerReceivedCard === true &&
      sellerReceivedPayment === true;
    const showFixedRatingCta =
      (isFixedBuyerResolved &&
        sellerDecision === "deal" &&
        bidderDecision === "deal" &&
        buyerReceivedCard === true) ||
      (isFixedSeller &&
        sellerDecision === "deal" &&
        bidderDecision === "deal" &&
        sellerReceivedPayment === true);
    const fixedRatingFieldsetLegend = isFixedSeller
      ? "Rate kjøper"
      : "Rate selger";
    const fixedRatingHelperText = isFixedSeller
      ? "Handelen er fullført. Du kan nå rate kjøper."
      : "Handelen er fullført. Du kan nå rate selger.";
    let fixedUserHasRatedThisDeal = false;
    if (showFixedRatingCta) {
      const { data: myRatingRow, error: myRatingErr } = await supabase
        .from("deal_ratings")
        .select("id")
        .eq("listing_id", id)
        .eq("from_user_id", user.id)
        .maybeSingle();
      if (myRatingErr) {
        console.error("deal_ratings:", myRatingErr.message);
      } else {
        fixedUserHasRatedThisDeal = myRatingRow != null;
      }
    }
    const fixedStatusGroup = resolveDealStatusGroup({
      sellerDecision,
      bidderDecision,
      buyerReceivedCard,
      sellerReceivedPayment,
      isCompleted: showFixedDealCompletedMessage,
    });
    const fixedStatusLabel = dealStatusGroupLabel(fixedStatusGroup);
    const fixedStatusDetail = dealStatusDetailText({
      group: fixedStatusGroup,
      viewerRole: isFixedSeller ? "seller" : "buyer",
      isFixedPrice: true,
      sellerDecision,
      bidderDecision,
      buyerReceivedCard,
      sellerReceivedPayment,
      counterpartUsername,
    });

    const offerNokDisplay =
      fixedDeal.offer_price_nok != null &&
      Number.isFinite(Number(fixedDeal.offer_price_nok))
        ? Math.trunc(Number(fixedDeal.offer_price_nok))
        : null;

    return (
      <div className={pageShellClass}>
        <header className={pageHeaderClass}>
          <p className="text-sm">
            <Link
              href="/my-auctions"
              className="font-medium text-zinc-700 underline-offset-2 hover:underline"
            >
              ← Mine deals
            </Link>
          </p>
          <h1 className={pageTitleClass}>Dealrom</h1>
          
        </header>

        <div className={`${pageBodyGapClass} space-y-8 text-sm`}>
          <section aria-labelledby="dealroom-summary-heading">
            <h2 id="dealroom-summary-heading" className={sectionLabelClass}>
              Dealoversikt
            </h2>
            <div className="mt-2 rounded-md border border-zinc-200 p-4">
              <p className="text-lg font-semibold text-zinc-950">
                {listing.title?.trim() || "—"}
              </p>
              {offerNokDisplay != null ? (
                <p className="mt-2 text-zinc-700">
                  Bud:{" "}
                  <span className="font-medium tabular-nums text-zinc-900">
                    {offerNokDisplay} NOK
                  </span>
                </p>
              ) : null}
              <p
                className={
                  offerNokDisplay != null ? "mt-1" : "mt-2"
                }
              >
                <span className="text-zinc-700">
                  Fastpris i annonsen:{" "}
                </span>
                <span className="font-medium tabular-nums text-zinc-900">
                  {listing.price_nok != null ? `${listing.price_nok} NOK` : "—"}
                </span>
              </p>
              <p className="mt-1 text-zinc-700">
                {isFixedSeller ? "Kjøper" : "Selger"}:{" "}
                <span className="font-medium text-zinc-900">
                  {counterpartUsername ?? "—"}
                </span>
              </p>
              <p className="mt-1 text-zinc-700">
                Du er:{" "}
                <span className="font-medium text-zinc-900">
                  {isFixedSeller ? "Selger" : "Kjøper"}
                </span>
              </p>
              <div className="mt-4 rounded-md border border-zinc-200 p-3">
                <p className={sectionLabelClass}>Status nå</p>
                <p className="mt-1 inline-flex w-fit rounded-full border border-zinc-300 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                  {fixedStatusLabel}
                </p>
                <p className="mt-2 text-zinc-600">
                  Neste steg: {fixedStatusDetail}
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="dealroom-deal-heading">
            <h2 id="dealroom-deal-heading" className={sectionLabelClass}>
              Handel
            </h2>
            <AuctionDealPanel
              listingId={id}
              returnToAfterDecision={`/my-auctions/${id}${fixedBidderId !== "" ? `?buyer=${encodeURIComponent(fixedBidderId)}` : ""}`}
              sellerDecision={sellerDecision}
              bidderDecision={bidderDecision}
              showSellerButtons={showFixedSellerButtons}
              showBidderButtons={showFixedBuyerButtons}
              dealBidderId={fixedBidderId}
            />
          </section>

          {showFixedDealCompletedMessage ? (
            <section aria-labelledby="dealroom-completed-heading">
              <h2
                id="dealroom-completed-heading"
                className={sectionLabelClass}
              >
                Fullført
              </h2>
              <p className="mt-2 text-zinc-700">
                Deal fullført
              </p>
            </section>
          ) : (
            <>
              {showFixedReceivedCardButton ? (
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
              {showFixedSellerPaymentButton ? (
                <section aria-labelledby="dealroom-received-payment-heading">
                  <h2
                    id="dealroom-received-payment-heading"
                    className={sectionLabelClass}
                  >
                    Betaling mottatt
                  </h2>
                  <SellerReceivedPaymentForm
                    listingId={id}
                    dealBidderId={fixedBidderId}
                  />
                </section>
              ) : null}
            </>
          )}

          {showFixedRatingCta ? (
            <section aria-labelledby="dealroom-rating-heading">
              <h2 id="dealroom-rating-heading" className={sectionLabelClass}>
                Vurdering
              </h2>
              {fixedUserHasRatedThisDeal ? (
                <p className="mt-2 text-zinc-600">
                  Du har ratet denne handelen.
                </p>
              ) : (
                <DealRatingForm
                  listingId={id}
                  dealBidderId={fixedBidderId}
                  intro={fixedRatingHelperText}
                  fieldsetLegend={fixedRatingFieldsetLegend}
                />
              )}
            </section>
          ) : null}

          <section aria-labelledby="dealroom-chat-heading">
            <h2 id="dealroom-chat-heading" className={sectionLabelClass}>
              Meldinger
            </h2>
            <DealMessagesPanel messages={fixedDealMessages} currentUserId={user.id} />
            <DealChatForm listingId={id} dealBidderId={fixedBidderId} />
          </section>
        </div>
      </div>
    );
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
      ? dealVenterActionHint(
          isSeller ? "seller" : "bidder",
          dealRow,
          counterpartUsername,
        )
      : undefined;

  const auctionStatusGroup = !hasAuctionBids || !contactUnlockedPostAuction
    ? "no_deal"
    : dealRow == null
      ? "deal_venter"
      : resolveDealStatusGroup({
          sellerDecision: dealRow.seller_decision,
          bidderDecision: dealRow.bidder_decision,
          buyerReceivedCard: dealRow.buyer_received_card,
          sellerReceivedPayment: dealRow.seller_received_payment,
          isCompleted: showDealCompletedMessage,
        });
  const topStatusLabel = dealStatusGroupLabel(auctionStatusGroup);
  const topStatusHelperText = dealStatusDetailText({
    group: auctionStatusGroup,
    viewerRole: isSeller ? "seller" : "buyer",
    isFixedPrice: false,
    sellerDecision: dealRow?.seller_decision ?? "pending",
    bidderDecision: dealRow?.bidder_decision ?? "pending",
    buyerReceivedCard: dealRow?.buyer_received_card ?? false,
    sellerReceivedPayment: dealRow?.seller_received_payment ?? false,
    counterpartUsername,
  });

  const auctionSellerCoverUrl = isSeller
    ? normalizeListingImageUrls(listing.image_urls)[0] ?? null
    : null;
  const auctionSellerReserveMinsteprisLine =
    listing.use_reserve_price === true &&
    listing.reserve_price_nok != null &&
    Number.isFinite(Number(listing.reserve_price_nok))
      ? `Ønsket minstepris: ${Math.trunc(Number(listing.reserve_price_nok))} NOK`
      : "Ingen ønsket minstepris";

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <p className="text-sm">
          <Link
            href="/my-auctions"
            className="font-medium text-zinc-700 underline-offset-2 hover:underline"
          >
            ← Mine deals
          </Link>
        </p>
        <h1 className={pageTitleClass}>Dealrom</h1>
        
      </header>

      <div className={`${pageBodyGapClass} space-y-8 text-sm`}>
        {isSeller ? (
          <section aria-labelledby="dealroom-summary-heading">
            <h2 id="dealroom-summary-heading" className={sectionLabelClass}>
              Dealoversikt
            </h2>
            <div className="mt-2 space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              {auctionSellerCoverUrl ? (
                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
                  <Image
                    src={auctionSellerCoverUrl}
                    alt=""
                    width={800}
                    height={420}
                    unoptimized
                    className="aspect-[16/9] w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex aspect-[16/9] w-full items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-500">
                  Ingen bilde
                </div>
              )}
              <div>
                <p className="text-lg font-semibold leading-snug text-zinc-950">
                  {listing.title?.trim() || "—"}
                </p>
                <p className="mt-3 text-sm text-zinc-700">
                  <span className="text-zinc-600">Høyeste bud gitt:</span>{" "}
                  <span className="font-semibold tabular-nums text-zinc-900">
                    {highestBidNok > 0 ? highestBidNok : 0} NOK
                  </span>
                </p>
                <p className="mt-2 text-sm text-zinc-700">
                  <span className="text-zinc-600">{auctionSellerReserveMinsteprisLine}</span>
                </p>
              </div>
              <div className="border-t border-zinc-100 pt-3 text-sm text-zinc-700">
                <p>
                  {isSeller ? "Budgiver" : "Selger"}:{" "}
                  <span className="font-medium text-zinc-900">
                    {counterpartUsername ?? "—"}
                  </span>
                </p>
                <p className="mt-1">
                  Du er:{" "}
                  <span className="font-medium text-zinc-900">Selger</span>
                </p>
              </div>
              <div className="border-t border-zinc-100 pt-3">
                <p className={sectionLabelClass}>Status</p>
                <p className="mt-2 inline-flex w-fit rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-semibold text-zinc-800">
                  {topStatusLabel}
                </p>
                {auctionStatusGroup === "deal_venter" ? (
                  <p className="mt-2 text-sm font-medium text-zinc-900">
                    {sellerAuctionDealVenterNextActionLine(
                      dealRow,
                      counterpartUsername,
                    )}
                  </p>
                ) : (
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                    {topStatusHelperText}
                  </p>
                )}
              </div>
            </div>
          </section>
        ) : (
          <>
            <section aria-labelledby="dealroom-summary-heading">
              <h2 id="dealroom-summary-heading" className={sectionLabelClass}>
                Dealoversikt
              </h2>
              <div className="mt-2 rounded-md border border-zinc-200 p-4">
                <p className="text-lg font-semibold text-zinc-950">
                  {listing.title?.trim() || "—"}
                </p>
                <p className="mt-2 text-zinc-700">
                  Selger:{" "}
                  <span className="font-medium text-zinc-900">
                    {counterpartUsername ?? "—"}
                  </span>
                </p>
                <p className="mt-1 text-zinc-700">
                  Du er:{" "}
                  <span className="font-medium text-zinc-900">
                    Kjøper
                  </span>
                </p>
                <div className="mt-4 rounded-md border border-zinc-200 p-3">
                  <p className={sectionLabelClass}>Status nå</p>
                  <p className="mt-1 inline-flex w-fit rounded-full border border-zinc-300 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                    {topStatusLabel}
                  </p>
                  <p className="mt-2 text-zinc-600">
                    Neste steg:{" "}
                    {topStatusHelperText}
                  </p>
                </div>
              </div>
            </section>

            <section aria-labelledby="dealroom-bid-heading">
              <h2 id="dealroom-bid-heading" className={sectionLabelClass}>
                Høyeste bud
              </h2>
              <p className="mt-2 tabular-nums text-zinc-800">
                {highestBidNok > 0 ? highestBidNok : 0}{" "}
                <span className="text-zinc-500">NOK</span>
              </p>
            </section>
          </>
        )}

        <section aria-labelledby="dealroom-contact-heading">
          <h2 id="dealroom-contact-heading" className={sectionLabelClass}>
            Kontakt
          </h2>
          <p className="mt-2 text-zinc-700">
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
                    <p className="mt-3 text-zinc-700">
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
            <p className="mt-2 text-zinc-700">Fullført</p>
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
              <p className="mt-2 text-zinc-600">
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
