import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { ContactSellerForm } from "./contact-seller-form";
import { FavoriteButton } from "./favorite-button";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ListingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select(
      "title, price_nok, description, created_at, seller_id, type, status",
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
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-16">
      <nav
        aria-label="Listing page"
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
      >
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Link href="/" className={navLinkClass}>
            Listings
          </Link>
          <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
            ·
          </span>
          <Link href="/dashboard" className={navLinkClass}>
            Dashboard
          </Link>
        </p>
        {showEdit ? (
          <Link href={`/listings/${id}/edit`} className={navLinkClass}>
            Edit
          </Link>
        ) : null}
      </nav>

      <header className="mt-10 border-b border-zinc-200 pb-8 dark:border-zinc-700">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">
          {listing.title}
        </h1>
        {user ? (
          <FavoriteButton listingId={id} isFavorite={isFavorite} />
        ) : null}
      </header>

      <div className="mt-8 space-y-10 text-sm">
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
