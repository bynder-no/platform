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

import { ContactSellerForm } from "./contact-seller-form";
import { FavoriteButton } from "./favorite-button";
import { PlaceBidForm } from "./place-bid-form";

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

function bidderLabel(
  p:
    | { display_name: string | null; username: string | null }
    | undefined
    | null,
) {
  if (!p) return "Member";
  return p.display_name?.trim() || p.username?.trim() || "Member";
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select(
      "title, price_nok, description, created_at, seller_id, type, status, auction_ends_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (listingError) {
    throw new Error(`Could not load listing: ${listingError.message}`);
  }

  if (!listing) {
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

  const bidProfileById = new Map<
    string,
    { display_name: string | null; username: string | null }
  >();
  if (auctionBids.length > 0) {
    const bidderIds = [...new Set(auctionBids.map((b) => b.bidder_id))];
    const { data: bidProfiles, error: bidProfilesError } = await supabase
      .from("profiles")
      .select("id, display_name, username")
      .in("id", bidderIds);

    if (bidProfilesError) {
      throw new Error(`Could not load bidder profiles: ${bidProfilesError.message}`);
    }

    for (const row of bidProfiles ?? []) {
      bidProfileById.set(row.id, row);
    }
  }

  const highestBidNok = auctionBids.reduce((max, b) => {
    const n = Number(b.amount_nok);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);

  const sellerUsername = seller?.username?.trim() || null;
  const sellerLabel =
    seller?.display_name?.trim() ||
    seller?.username?.trim() ||
    null;

  const showEdit =
    user &&
    listing.status === "draft" &&
    user.id === listing.seller_id;

  const showContactSeller = Boolean(user && user.id !== listing.seller_id);

  const auctionEndMs = listing.auction_ends_at
    ? new Date(listing.auction_ends_at).getTime()
    : null;
  const showPlaceBid = Boolean(
    user &&
      listing.type === "auction" &&
      listing.status === "active" &&
      auctionEndMs !== null &&
      !Number.isNaN(auctionEndMs) &&
      auctionEndMs > Date.now() &&
      user.id !== listing.seller_id,
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
            {listing.price_nok != null ? (
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
          <p className="mt-3">
            <span className="inline-block rounded-md border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-sm font-semibold text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
              {typeLabel}
            </span>
          </p>
        </section>

        {listing.type === "auction" ? (
          <section aria-labelledby="listing-auction-ends-heading">
            <h2 id="listing-auction-ends-heading" className={sectionLabelClass}>
              Auction ends
            </h2>
            <p className="mt-3 text-zinc-700 dark:text-zinc-300">
              {listing.auction_ends_at
                ? new Date(listing.auction_ends_at).toLocaleString()
                : "—"}
            </p>
          </section>
        ) : null}

        {listing.type === "auction" ? (
          <section aria-labelledby="listing-auction-bids-heading">
            <h2 id="listing-auction-bids-heading" className={sectionLabelClass}>
              Bids
            </h2>
            <p className="mt-3 text-zinc-700 dark:text-zinc-300">
              <span className="text-zinc-500 dark:text-zinc-400">
                Current highest:{" "}
              </span>
              {highestBidNok > 0 ? (
                <>
                  {highestBidNok}
                  <span className="text-zinc-500 dark:text-zinc-400"> NOK</span>
                </>
              ) : (
                "No bids yet"
              )}
            </p>
            {auctionBids.length > 0 ? (
              <ul className="mt-4 space-y-2 border-t border-zinc-200 pt-4 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                {auctionBids.map((bid) => {
                  const amount = Number(bid.amount_nok);
                  const label = bidderLabel(bidProfileById.get(bid.bidder_id));
                  const when = bid.created_at
                    ? new Date(bid.created_at).toLocaleString()
                    : "—";

                  return (
                    <li key={bid.id} className="text-sm">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {Number.isFinite(amount) ? amount : "—"} NOK
                      </span>
                      <span className="text-zinc-300 dark:text-zinc-600"> · </span>
                      {label}
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
            <PlaceBidForm listingId={id} />
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
      </div>
    </div>
  );
}
