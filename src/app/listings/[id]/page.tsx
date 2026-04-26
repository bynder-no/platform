import Link from "next/link";
import { notFound } from "next/navigation";

import { SignedInNavLinks } from "@/components/signed-in-nav-links";
import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";

import { AuctionDealPanel } from "./auction-deal-panel";
import { startFixedPricePurchase } from "./actions";
import { ContactSellerForm } from "./contact-seller-form";
import { FavoriteButton } from "./favorite-button";
import { PlaceBidForm } from "./place-bid-form";
import { viewerAuctionBidPositionLabel } from "@/lib/auction-viewer-bid-status";

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

function bidderPrivacyLabel(userId: string | undefined, bidderId: string) {
  return userId && bidderId === userId ? "You" : "Another bidder";
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: publishDueError } = await supabase.rpc("publish_due_auctions");
  if (publishDueError) {
    console.error("publish_due_auctions:", publishDueError.message);
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select(
      "title, price_nok, min_bid_increment_nok, description, created_at, seller_id, type, status, auction_starts_at, auction_ends_at, use_reserve_price, reserve_price_nok, contact_threshold_percent, auction_outcome",
    )
    .eq("id", id)
    .maybeSingle();

  if (listingError) {
    throw new Error(`Could not load listing: ${listingError.message}`);
  }

  if (!listing) {
    notFound();
  }

  const nowMs = new Date().getTime();

  let auctionState: "scheduled" | "live" | "ended" | null = null;
  if (listing.type === "auction") {
    const startsAtMs = listing.auction_starts_at
      ? new Date(listing.auction_starts_at).getTime()
      : Number.NaN;
    const endsAtMs = listing.auction_ends_at
      ? new Date(listing.auction_ends_at).getTime()
      : Number.NaN;

    if (Number.isFinite(startsAtMs) && nowMs < startsAtMs) {
      auctionState = "scheduled";
    } else if (Number.isFinite(endsAtMs) && nowMs >= endsAtMs) {
      auctionState = "ended";
    } else {
      auctionState = "live";
    }
  }
  const auctionTimeEnded = auctionState === "ended";
  const auctionTimeScheduled = auctionState === "scheduled";
  const auctionTimeLive = auctionState === "live";

  if (
    listing.type === "auction" &&
    auctionTimeScheduled &&
    (!user || user.id !== listing.seller_id)
  ) {
    notFound();
  }

  const { data: seller, error: sellerError } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", listing.seller_id)
    .maybeSingle();

  if (sellerError) {
    throw new Error(`Could not load seller: ${sellerError.message}`);
  }

  let auctionBids: BidRow[] = [];
  if (listing.type === "auction") {
    const { data: bidRows, error: bidsError } = await supabase
      .from("bids")
      .select("id, amount_nok, created_at, bidder_id")
      .eq("listing_id", id)
      .order("created_at", { ascending: true });

    if (bidsError) {
      throw new Error(`Could not load bids: ${bidsError.message}`);
    }

    auctionBids = (bidRows ?? []) as BidRow[];
  }

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

  const sellerUsername = seller?.username?.trim() || null;
  const sellerLabel =
    seller?.display_name?.trim() ||
    seller?.username?.trim() ||
    null;

  const showEdit =
    user &&
    listing.status === "draft" &&
    user.id === listing.seller_id;

  const hasAuctionBids = listing.type === "auction" && auctionBids.length > 0;

  const leadingBidderIdForViewerLabel =
    leadingBidRow != null &&
    leadingBidRow.bidder_id != null &&
    String(leadingBidRow.bidder_id).trim() !== ""
      ? String(leadingBidRow.bidder_id).trim()
      : null;
  const viewerAuctionBidLabel =
    user != null && user.id !== listing.seller_id
      ? viewerAuctionBidPositionLabel(
          user.id,
          hasAuctionBids,
          leadingBidderIdForViewerLabel,
        )
      : null;

  let contactUnlockedPostAuction = false;
  if (listing.type === "auction" && auctionTimeEnded) {
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
  }

  const auctionEndedContactMessage =
    listing.type === "auction" && auctionTimeEnded
      ? !hasAuctionBids
        ? "Ingen bud mottatt"
        : !contactUnlockedPostAuction
          ? "Auksjonen er avsluttet uten åpnet kontakt"
          : "Kontakt er åpnet mellom selger og høyeste budgiver"
      : null;

  const showContactSeller = Boolean(
    user &&
      (listing.type !== "auction"
        ? user.id !== listing.seller_id
        : !auctionTimeEnded
          ? user.id !== listing.seller_id
          : contactUnlockedPostAuction &&
            (user.id === listing.seller_id ||
              (leadingBidRow != null &&
                user.id === leadingBidRow.bidder_id))),
  );

  const eligibleForAuctionDeal =
    listing.type === "auction" &&
    auctionTimeEnded &&
    contactUnlockedPostAuction &&
    leadingBidRow != null &&
    user &&
    (user.id === listing.seller_id || user.id === leadingBidRow.bidder_id);

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

  if (user && listing.type === "auction" && auctionTimeEnded) {
    const dealNoOutcome =
      dealRow != null &&
      (dealRow.seller_decision === "no_deal" ||
        dealRow.bidder_decision === "no_deal");

    const canNotifyAuctionNoResult =
      listingSellerIdForDeal !== "" &&
      (user.id === listingSellerIdForDeal ||
        (winningBidderIdForDeal !== "" &&
          user.id === winningBidderIdForDeal));

    const isExpectedAuctionNoResultDuplicate = (msg: string) =>
      msg.includes("notifications_unique_one_time_event_idx") ||
      msg.includes("duplicate key value violates unique constraint");

    const tryAuctionNoResult = async (
      recipientUserId: string,
      message: string,
    ) => {
      if (recipientUserId === "" || !canNotifyAuctionNoResult) {
        return;
      }
      if (user.id === recipientUserId) {
        const { data: existing, error: existingErr } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", user.id)
          .eq("type", "auction_no_result")
          .eq("listing_id", id)
          .limit(1)
          .maybeSingle();
        if (existingErr) {
          console.error(
            "notifications auction_no_result lookup:",
            existingErr.message,
          );
        } else if (existing) {
          return;
        }
      }
      const { error: rpcErr } = await supabase.rpc("create_notification", {
        p_user_id: recipientUserId,
        p_type: "auction_no_result",
        p_listing_id: id,
        p_message: message,
      });
      if (rpcErr) {
        const msg = rpcErr.message ?? "";
        if (!isExpectedAuctionNoResultDuplicate(msg)) {
          console.error(
            "create_notification auction_no_result:",
            rpcErr.message,
          );
        }
      }
    };

    if (
      dealNoOutcome &&
      winningBidderIdForDeal !== "" &&
      listingSellerIdForDeal !== "" &&
      canNotifyAuctionNoResult
    ) {
      await tryAuctionNoResult(
        listingSellerIdForDeal,
        "Handelen ble ikke gjennomført",
      );
      await tryAuctionNoResult(
        winningBidderIdForDeal,
        "Handelen ble ikke gjennomført",
      );
    }
  }

  const showPlaceBid = Boolean(
    user &&
      listing.type === "auction" &&
      auctionTimeLive &&
      user.id !== listing.seller_id,
  );
  const showBuyButton = Boolean(
    user &&
      listing.type === "fixed_price" &&
      (listing.status === "active" || listing.status === "public") &&
      user.id !== listing.seller_id,
  );

  const showAuctionEndedNotice = listing.type === "auction" && auctionTimeEnded;

  const listingPriceNok =
    listing.price_nok != null && Number.isFinite(Number(listing.price_nok))
      ? Math.trunc(Number(listing.price_nok))
      : null;
  const minBidIncrementNok =
    listing.min_bid_increment_nok != null &&
    Number.isFinite(Number(listing.min_bid_increment_nok))
      ? Math.trunc(Number(listing.min_bid_increment_nok))
      : null;
  const minimumNextBidNok =
    highestBidNok > 0
      ? minBidIncrementNok != null
        ? highestBidNok + minBidIncrementNok
        : null
      : listingPriceNok;

  let isFavorite = false;
  if (user) {
    const { data: favoriteRow } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("listing_id", id)
      .maybeSingle();
    isFavorite = Boolean(favoriteRow);
  }

  const typeLabel =
    listing.type === "auction"
      ? "Auction"
      : listing.type === "fixed_price"
        ? "Fixed price"
        : "—";

  const auctionStateLabelNo: "Planlagt" | "Live" | "Avsluttet" | null =
    listing.type === "auction" && auctionState != null
      ? auctionState === "scheduled"
        ? "Planlagt"
        : auctionState === "ended"
          ? "Avsluttet"
          : "Live"
      : null;

  const sectionLabelClass =
    "text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

  const navLinkClass =
    "text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300";

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <h1 className={pageTitleClass}>{listing.title}</h1>
        {user ? (
          <FavoriteButton listingId={id} isFavorite={isFavorite} />
        ) : null}
        <nav
          aria-label="Listing page"
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
        >
          {user ? (
            <SignedInNavLinks />
          ) : (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <Link href="/" className={navLinkClass}>
                Home
              </Link>
              <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
                ·
              </span>
              <Link href="/dashboard" className={navLinkClass}>
                Dashboard
              </Link>
            </p>
          )}
          {showEdit ? (
            <Link href={`/listings/${id}/edit`} className={navLinkClass}>
              Edit
            </Link>
          ) : null}
        </nav>
      </header>

      <div className={`${pageBodyGapClass} space-y-10 text-sm`}>
        <section aria-labelledby="listing-price-heading">
          <h2 id="listing-price-heading" className={sectionLabelClass}>
            Price
          </h2>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 tabular-nums">
            {listing.type === "auction" ? (
              <>
                <span>{highestBidNok > 0 ? highestBidNok : 0}</span>
                <span className="ml-1.5 text-base font-medium text-zinc-500 dark:text-zinc-400">
                  NOK
                </span>
              </>
            ) : listing.price_nok != null ? (
              <>
                <span>{listing.price_nok}</span>
                <span className="ml-1.5 text-base font-medium text-zinc-500 dark:text-zinc-400">
                  NOK
                </span>
              </>
            ) : (
              "—"
            )}
          </p>
        </section>

        <section aria-labelledby="listing-type-heading">
          <h2 id="listing-type-heading" className={sectionLabelClass}>
            Type
          </h2>
          <p className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-block rounded-md border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-sm font-semibold text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
              {typeLabel}
            </span>
            {auctionStateLabelNo ? (
              <span className="inline-block rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-sm font-semibold text-zinc-800 dark:border-zinc-500 dark:bg-zinc-900 dark:text-zinc-100">
                {auctionStateLabelNo}
              </span>
            ) : null}
          </p>
        </section>

        {listing.type === "auction" ? (
          <section aria-labelledby="listing-auction-ends-heading">
            <h2 id="listing-auction-ends-heading" className={sectionLabelClass}>
              Auction ends
            </h2>
            <p className="mt-3 text-zinc-700 dark:text-zinc-300">
              {listing.auction_ends_at ? (
                <time dateTime={String(listing.auction_ends_at)}>
                  {new Date(listing.auction_ends_at).toLocaleString()}
                </time>
              ) : (
                "—"
              )}
            </p>
          </section>
        ) : null}

        {listing.type === "auction" ? (
          <section aria-labelledby="listing-auction-bids-heading">
            <h2 id="listing-auction-bids-heading" className={sectionLabelClass}>
              Bids
            </h2>
            {highestBidNok > 0 && leadingBidRow ? (
              <div className="mt-3 space-y-2 text-zinc-700 dark:text-zinc-300">
                <p>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {auctionTimeEnded ? "Winning bid: " : "Current bid: "}
                  </span>
                  <span className="tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                    {highestBidNok}
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400"> NOK</span>
                </p>
                <p>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {auctionTimeEnded ? "Winner: " : "Leading bidder: "}
                  </span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {bidderPrivacyLabel(user?.id, leadingBidRow.bidder_id)}
                  </span>
                </p>
                {viewerAuctionBidLabel ? (
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    {viewerAuctionBidLabel}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-zinc-700 dark:text-zinc-300">
                {auctionTimeEnded ? "No bids were placed" : "No bids yet"}
              </p>
            )}
            {auctionBids.length > 0 ? (
              <ul className="mt-4 space-y-2 border-t border-zinc-200 pt-4 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                {auctionBids.map((bid) => {
                  const amount = Number(bid.amount_nok);
                  const when = bid.created_at
                    ? new Date(bid.created_at).toLocaleString()
                    : "—";

                  return (
                    <li key={bid.id} className="text-sm">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {Number.isFinite(amount) ? amount : "—"} NOK
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-600"> · </span>
                      {bidderPrivacyLabel(user?.id, bid.bidder_id)}
                      <span className="text-zinc-300 dark:text-zinc-600"> · </span>
                      {when}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        ) : null}

        <section aria-labelledby="listing-description-heading">
          <h2 id="listing-description-heading" className={sectionLabelClass}>
            Description
          </h2>
          <p className="mt-3 whitespace-pre-wrap leading-relaxed text-zinc-600 dark:text-zinc-400">
            {listing.description?.trim() || "—"}
          </p>
        </section>

        <section aria-labelledby="listing-listed-heading">
          <h2 id="listing-listed-heading" className={sectionLabelClass}>
            Listed
          </h2>
          <p className="mt-3 text-zinc-700 dark:text-zinc-300">
            {listing.created_at
              ? new Date(listing.created_at).toLocaleString()
              : "—"}
          </p>
        </section>

        {sellerLabel ? (
          <section aria-labelledby="listing-seller-heading">
            <h2 id="listing-seller-heading" className={sectionLabelClass}>
              Seller
            </h2>
            <p className="mt-3 text-zinc-700 dark:text-zinc-300">
              {sellerUsername ? (
                <Link
                  href={`/u/${encodeURIComponent(sellerUsername)}`}
                  className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                >
                  {sellerLabel}
                </Link>
              ) : (
                sellerLabel
              )}
            </p>
          </section>
        ) : null}

        {showPlaceBid ? (
          <section aria-labelledby="listing-bid-heading">
            <h2 id="listing-bid-heading" className={sectionLabelClass}>
              Place a bid
            </h2>
            <PlaceBidForm
              listingId={id}
              minBidNok={minimumNextBidNok}
            />
          </section>
        ) : null}

        {showBuyButton ? (
          <section aria-labelledby="listing-buy-heading">
            <h2 id="listing-buy-heading" className={sectionLabelClass}>
              Kjøp
            </h2>
            <form action={startFixedPricePurchase} className="mt-3">
              <input type="hidden" name="listing_id" value={id} />
              <button
                type="submit"
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Kjøp
              </button>
            </form>
          </section>
        ) : null}

        {auctionTimeScheduled ? (
          <section aria-labelledby="listing-auction-scheduled-heading">
            <h2
              id="listing-auction-scheduled-heading"
              className={sectionLabelClass}
            >
              Bidding
            </h2>
            <p className="mt-3 text-zinc-700 dark:text-zinc-300">Planlagt</p>
          </section>
        ) : null}

        {showAuctionEndedNotice && auctionEndedContactMessage ? (
          <section aria-labelledby="listing-auction-ended-heading">
            <h2 id="listing-auction-ended-heading" className={sectionLabelClass}>
              Bidding
            </h2>
            <p className="mt-3 text-zinc-700 dark:text-zinc-300">
              {auctionEndedContactMessage}
            </p>
          </section>
        ) : null}

        {showContactSeller ? (
          <section aria-labelledby="listing-contact-heading">
            <h2 id="listing-contact-heading" className={sectionLabelClass}>
              Contact seller
            </h2>
            <ContactSellerForm listingId={id} />
          </section>
        ) : null}

        {eligibleForAuctionDeal && dealRow ? (
          <section aria-labelledby="listing-deal-heading">
            <h2 id="listing-deal-heading" className={sectionLabelClass}>
              Handel
            </h2>
            <AuctionDealPanel
              listingId={id}
              sellerDecision={dealRow.seller_decision}
              bidderDecision={dealRow.bidder_decision}
              showSellerButtons={
                user!.id === listing.seller_id &&
                dealRow.seller_decision === "pending"
              }
              showBidderButtons={
                leadingBidRow != null &&
                user!.id === leadingBidRow.bidder_id &&
                dealRow.bidder_decision === "pending"
              }
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
