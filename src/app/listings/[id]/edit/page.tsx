import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SignedInNavLinks } from "@/components/signed-in-nav-links";
import { createClient } from "@/lib/supabase/server";
import {
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";

import { EditListingForm } from "./edit-listing-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditListingPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select(
      "id, title, description, price_nok, type, status, seller_id, auction_starts_at, auction_ends_at, min_bid_increment_nok, reserve_price_nok, contact_threshold_percent, use_reserve_price",
    )
    .eq("id", id)
    .maybeSingle();

  if (listingError) {
    throw new Error(`Could not load listing: ${listingError.message}`);
  }

  if (
    !listing ||
    listing.seller_id !== user.id ||
    listing.status !== "draft"
  ) {
    notFound();
  }

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className={pageTitleClass}>Edit listing</h1>
          <Link
            href={`/listings/${listing.id}`}
            className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
          >
            Back
          </Link>
        </div>
        <SignedInNavLinks />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          You can edit this listing while it is a draft.
        </p>
      </header>

      <EditListingForm
        listingId={listing.id}
        defaultTitle={listing.title}
        defaultDescription={listing.description ?? ""}
        defaultPriceNok={listing.price_nok ?? 0}
        defaultType={listing.type ?? "fixed_price"}
        defaultAuctionStartsAt={listing.auction_starts_at}
        defaultAuctionEndsAt={listing.auction_ends_at}
        defaultMinBidIncrementNok={listing.min_bid_increment_nok}
        defaultReservePriceNok={listing.reserve_price_nok}
        defaultContactThresholdPercent={listing.contact_threshold_percent}
        defaultUseReservePrice={Boolean(listing.use_reserve_price)}
      />
    </div>
  );
}
