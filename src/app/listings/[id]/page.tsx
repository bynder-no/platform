import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
} from "@/lib/page-layout";

import { AuctionDealPanel } from "./auction-deal-panel";
import { FixedPriceOfferForm } from "./fixed-price-offer-form";
import { DeleteFixedPriceForm } from "./delete-fixed-price-form";
import { FavoriteButton } from "./favorite-button";
import { ListingAuctionBidPanel } from "./listing-auction-bid-panel";
import { viewerAuctionBidPositionLabel } from "@/lib/auction-viewer-bid-status";
import { normalizeListingImageUrls } from "@/lib/listing-images";
import { TITLE_KORTSELGER } from "@/lib/profile-titles";
import { auctionTimeRemainingLabelFromState } from "@/lib/auction-time-remaining-no";
import { nextValidBidAmountNok } from "@/lib/auction-next-bid-nok";

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

const LISTING_CATEGORY_LABEL: Record<string, string> = {
  single_card: "Singelkort",
  slab: "PSA/slabs",
  sealed: "Sealed produkter",
  bulk: "Bulk / mange kort",
};

function listingCategoryDisplayLabel(
  category: string | null | undefined,
): string | null {
  if (category == null || String(category).trim() === "") return null;
  const k = String(category).trim();
  return LISTING_CATEGORY_LABEL[k] ?? null;
}

function formatAuctionEndsAtLineNbNo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const datePart = d.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timePart = d.toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${datePart} kl. ${timePart}`;
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
      "title, price_nok, min_bid_increment_nok, description, image_urls, created_at, seller_id, type, status, category, auction_starts_at, auction_ends_at, use_reserve_price, reserve_price_nok, contact_threshold_percent, auction_outcome",
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
    .select("display_name, username, active_title")
    .eq("id", listing.seller_id)
    .maybeSingle();

  if (sellerError) {
    throw new Error(`Could not load seller: ${sellerError.message}`);
  }

  let sellerRatingAverageDisplay: string | null = null;
  let sellerRatingCount = 0;
  if (listing.seller_id) {
    const { data: sellerRatingsReceived, error: sellerRatingsErr } =
      await supabase
        .from("deal_ratings")
        .select("score")
        .eq("to_user_id", listing.seller_id);

    if (sellerRatingsErr) {
      throw new Error(
        `Could not load seller ratings: ${sellerRatingsErr.message}`,
      );
    }

    const sellerRatingScores = (sellerRatingsReceived ?? [])
      .map((r) => Number(r.score))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
    sellerRatingCount = sellerRatingScores.length;
    if (sellerRatingCount > 0) {
      const sum = sellerRatingScores.reduce((a, b) => a + b, 0);
      sellerRatingAverageDisplay = (
        Math.round((sum / sellerRatingCount) * 10) / 10
      ).toFixed(1);
    }
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
  const sellerActiveTitle =
    typeof seller?.active_title === "string"
      ? seller.active_title.trim()
      : "";

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
  const showDeleteFixedPrice = Boolean(
    user && listing.type === "fixed_price" && user.id === listing.seller_id,
  );

  const showAuctionEndedNotice = listing.type === "auction" && auctionTimeEnded;

  const listingPriceNok =
    listing.price_nok != null && Number.isFinite(Number(listing.price_nok))
      ? Math.trunc(Number(listing.price_nok))
      : null;
  const minimumNextBidNok = nextValidBidAmountNok(
    hasAuctionBids,
    highestBidNok,
    listing.price_nok,
    listing.min_bid_increment_nok,
  );

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

  const categoryDisplayLabel = listingCategoryDisplayLabel(
    typeof listing.category === "string" ? listing.category : null,
  );

  const auctionStateLabelNo: "Planlagt" | "Live" | "Avsluttet" | null =
    listing.type === "auction" && auctionState != null
      ? auctionState === "scheduled"
        ? "Planlagt"
        : auctionState === "ended"
          ? "Avsluttet"
          : "Live"
      : null;

  const auctionTimingLabel =
    listing.type === "auction" && auctionStateLabelNo != null
      ? auctionTimeRemainingLabelFromState(
          auctionStateLabelNo,
          listing.auction_starts_at ?? null,
          listing.auction_ends_at ?? null,
          nowMs,
        )
      : null;

  const sectionLabelClass =
    "text-xs font-semibold uppercase tracking-wide text-zinc-500";
  const imageUrls = normalizeListingImageUrls(listing.image_urls);
  const coverImage = imageUrls[0] ?? null;
  const restImages = imageUrls.slice(1, 3);

  const navLinkClass =
    "text-sm font-medium text-zinc-700 underline-offset-2 hover:underline";

  const cardClass = "rounded-2xl border border-zinc-200 bg-white shadow-sm";

  const fixedPriceOpenButtonClass =
    "w-full rounded-lg bg-blue-600 px-4 py-3.5 text-center text-base font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50";

  const favoriteButtonFixedClassName =
    "w-full justify-center rounded-lg border border-zinc-300 bg-white py-2.5 text-sm font-medium text-zinc-600 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-800 disabled:opacity-50";

  const sellerSection = sellerLabel ? (
    <div className="mt-6 border-t border-zinc-100 pt-6">
      <p className={sectionLabelClass}>Seller</p>
      <p className="mt-2 text-base font-medium text-zinc-900">
        {sellerUsername ? (
          <Link
            href={`/u/${encodeURIComponent(sellerUsername)}`}
            className="underline-offset-2 hover:underline"
          >
            {sellerLabel}
          </Link>
        ) : (
          sellerLabel
        )}
      </p>
      {sellerRatingCount > 0 ? (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm">
          <span className="text-lg font-semibold tabular-nums text-zinc-900">
            {sellerRatingAverageDisplay ?? "—"}
          </span>
          <span className="text-zinc-500">av 5</span>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-500">
            {sellerRatingCount}{" "}
            {sellerRatingCount === 1 ? "vurdering" : "vurderinger"}
          </span>
        </div>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">Ingen vurderinger ennå</p>
      )}
      {listing.type === "fixed_price" && listing.created_at ? (
        <p className="mt-2 text-sm text-zinc-500">
          Lagt ut:{" "}
          {new Date(listing.created_at).toLocaleDateString("nb-NO", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      ) : null}
      {sellerActiveTitle !== "" &&
      sellerActiveTitle !== TITLE_KORTSELGER ? (
        <p className="mt-3">
          <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900">
            {sellerActiveTitle}
          </span>
        </p>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className={pageShellClass}>
        <header className={pageHeaderClass}>
          <nav
            aria-label="Listing page"
            className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${user ? "justify-end" : "justify-between"}`}
          >
            {user ? null : (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <Link href="/" className={navLinkClass}>
                  Home
                </Link>
                <span className="text-zinc-300" aria-hidden>
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

        <div className={`${pageBodyGapClass} space-y-10 text-sm text-zinc-900`}>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,400px)] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section
              aria-labelledby="listing-images-heading"
              className="order-1 min-w-0"
            >
              <h2 id="listing-images-heading" className="sr-only">
                Bilder
              </h2>
              <div className={`${cardClass} p-4 sm:p-6`}>
                {coverImage ? (
                  <div className="space-y-4">
                    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                      <Image
                        src={coverImage}
                        alt={`Bilde av ${listing.title}`}
                        width={1280}
                        height={960}
                        unoptimized
                        className="mx-auto h-auto max-h-[min(56vh,520px)] w-full object-contain"
                      />
                    </div>
                    {restImages.length > 0 ? (
                      <ul className="flex flex-wrap gap-2 sm:gap-3">
                        {restImages.map((url) => (
                          <li
                            key={url}
                            className="w-[calc(50%-0.25rem)] shrink-0 sm:w-28"
                          >
                            <Image
                              src={url}
                              alt={`Ekstra bilde av ${listing.title}`}
                              width={160}
                              height={120}
                              unoptimized
                              className="h-24 w-full rounded-lg border border-zinc-200 bg-white object-cover"
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-zinc-600">Ingen bilder lagt til.</p>
                )}
              </div>
            </section>

            <aside className="order-2 lg:sticky lg:top-8 lg:self-start">
              <div className={`${cardClass} p-6`}>
                <h1 className="text-balance text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
                  {listing.title}
                </h1>

                <div className="mt-6">
                  {listing.type === "auction" ? (
                    <>
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50/90 px-3 py-3 sm:px-4">
                        <p className={sectionLabelClass}>Høyeste bud</p>
                        <div className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums text-zinc-900 sm:text-3xl">
                          {hasAuctionBids ? (
                            <>
                              <span>{highestBidNok}</span>
                              <span className="ml-1.5 text-base font-medium text-zinc-500 sm:text-lg">
                                NOK
                              </span>
                            </>
                          ) : listingPriceNok != null ? (
                            <>
                              <span>{listingPriceNok}</span>
                              <span className="ml-1.5 text-base font-medium text-zinc-500 sm:text-lg">
                                NOK
                              </span>
                              <span className="mt-1.5 block text-sm font-normal leading-snug text-zinc-500">
                                {auctionTimeEnded
                                  ? "Ingen bud mottatt"
                                  : "Ingen bud ennå"}
                              </span>
                            </>
                          ) : (
                            <span className="text-xl font-semibold tracking-tight text-zinc-700 sm:text-2xl">
                              Ingen bud
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        {auctionStateLabelNo === "Avsluttet" ? (
                          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                            <span className="font-medium text-zinc-600">
                              Avsluttet
                            </span>
                            {listing.auction_ends_at ? (
                              <>
                                <span className="text-zinc-400" aria-hidden>
                                  ·
                                </span>
                                <span className="tabular-nums">
                                  <time
                                    dateTime={String(listing.auction_ends_at)}
                                  >
                                    {new Date(
                                      listing.auction_ends_at,
                                    ).toLocaleString("nb-NO")}
                                  </time>
                                </span>
                              </>
                            ) : null}
                            <span className="text-zinc-400" aria-hidden>
                              •
                            </span>
                            <span className="tabular-nums">
                              {auctionBids.length} bud
                            </span>
                          </div>
                        ) : auctionTimingLabel ? (
                          <>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="font-medium text-zinc-600">
                                Tid igjen
                              </span>
                              <span className="tabular-nums">
                                {auctionTimingLabel}
                              </span>
                              <span className="text-zinc-400" aria-hidden>
                                •
                              </span>
                              <span className="tabular-nums">
                                {auctionBids.length} bud
                              </span>
                            </div>
                            {listing.auction_ends_at ? (
                              <p className="mt-1.5 text-sm text-zinc-500">
                                Avsluttes{" "}
                                <time
                                  className="tabular-nums"
                                  dateTime={String(listing.auction_ends_at)}
                                >
                                  {formatAuctionEndsAtLineNbNo(
                                    String(listing.auction_ends_at),
                                  )}
                                </time>
                              </p>
                            ) : null}
                          </>
                        ) : null}
                        {viewerAuctionBidLabel ? (
                          <p className="text-xs font-medium text-amber-800">
                            {viewerAuctionBidLabel}
                          </p>
                        ) : null}
                        {!hasAuctionBids && listingPriceNok == null ? (
                          <p className="text-sm text-zinc-600">
                            {auctionTimeEnded
                              ? "No bids were placed"
                              : "No bids yet"}
                          </p>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className={sectionLabelClass}>Price</p>
                      <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-zinc-900 sm:text-4xl">
                        {listing.price_nok != null ? (
                          <>
                            <span>{listing.price_nok}</span>
                            <span className="ml-1.5 text-lg font-medium text-zinc-500 sm:text-xl">
                              NOK
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </p>
                    </>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-900">
                    {typeLabel}
                  </span>
                  {categoryDisplayLabel ? (
                    <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                      {categoryDisplayLabel}
                    </span>
                  ) : null}
                  {auctionStateLabelNo ? (
                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
                      {auctionStateLabelNo}
                    </span>
                  ) : null}
                </div>

                {listing.type === "auction" && showPlaceBid ? (
                  <ListingAuctionBidPanel
                    listingId={id}
                    minBidNok={minimumNextBidNok}
                  />
                ) : null}

                {listing.type === "auction" ? (
                  <>
                    {sellerSection}
                    {user ? (
                      <div className="mt-5 border-t border-zinc-100 pt-5">
                        <FavoriteButton
                          listingId={id}
                          isFavorite={isFavorite}
                          formClassName="mt-0"
                        />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    {showBuyButton ? (
                      <div className="mt-4">
                        <FixedPriceOfferForm
                          listingId={id}
                          defaultOfferNok={listingPriceNok ?? 1}
                          listingTitle={listing.title?.trim() || "Annonse"}
                          originalPriceNok={listingPriceNok}
                          thumbnailUrl={coverImage}
                          openButtonClassName={fixedPriceOpenButtonClass}
                        />
                      </div>
                    ) : null}
                    {user ? (
                      <div className="mt-4">
                        <FavoriteButton
                          listingId={id}
                          isFavorite={isFavorite}
                          formClassName="mt-0 w-full"
                          buttonClassName={favoriteButtonFixedClassName}
                        />
                      </div>
                    ) : null}
                    {listing.description?.trim() ? (
                      <div className="mt-5 border-t border-zinc-100 pt-5">
                        <h3 className="text-sm font-semibold text-zinc-900">
                          Beskrivelse
                        </h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                          {listing.description.trim()}
                        </p>
                      </div>
                    ) : null}
                    {sellerSection}
                  </>
                )}
              </div>
            </aside>
          </div>

          <div className="space-y-10">
            {listing.type === "auction" ? (
              <section
                aria-labelledby="listing-description-heading"
                className={`${cardClass} p-6 sm:p-8`}
              >
                <h2
                  id="listing-description-heading"
                  className="text-lg font-semibold text-zinc-900"
                >
                  Description
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Listed{" "}
                  {listing.created_at
                    ? new Date(listing.created_at).toLocaleString()
                    : "—"}
                </p>
                <p className="mt-5 whitespace-pre-wrap leading-relaxed text-zinc-700">
                  {listing.description?.trim() || "—"}
                </p>
              </section>
            ) : null}

            {showDeleteFixedPrice ? (
              <section
                aria-labelledby="listing-delete-heading"
                className={`${cardClass} p-6`}
              >
                <h2
                  id="listing-delete-heading"
                  className="text-sm font-semibold uppercase tracking-wide text-zinc-500"
                >
                  Slett annonse
                </h2>
                <div className="mt-4">
                  <DeleteFixedPriceForm listingId={id} returnTo="/my-listings" />
                </div>
              </section>
            ) : null}

            {showAuctionEndedNotice && auctionEndedContactMessage ? (
              <section
                aria-labelledby="listing-auction-ended-heading"
                className={`${cardClass} p-6`}
              >
                <h2
                  id="listing-auction-ended-heading"
                  className="text-sm font-semibold uppercase tracking-wide text-zinc-500"
                >
                  Bidding
                </h2>
                <p className="mt-3 text-zinc-700">
                  {auctionEndedContactMessage}
                </p>
              </section>
            ) : null}

            {eligibleForAuctionDeal && dealRow ? (
              <section
                aria-labelledby="listing-deal-heading"
                className={`${cardClass} p-6`}
              >
                <h2
                  id="listing-deal-heading"
                  className="text-sm font-semibold uppercase tracking-wide text-zinc-500"
                >
                  Handel
                </h2>
                <div className="mt-4">
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
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
