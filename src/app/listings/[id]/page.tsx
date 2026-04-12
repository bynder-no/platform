import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

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

  if (
    listing.status === "draft" &&
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

  const sellerLabel =
    seller?.display_name?.trim() ||
    seller?.username?.trim() ||
    null;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-16">
      <div className="flex items-baseline justify-between gap-4">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
        >
          Dashboard
        </Link>
      </div>

      <h1 className="mt-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        {listing.title}
      </h1>

      <dl className="mt-8 space-y-4 text-sm">
        <div>
          <dt className="font-medium text-zinc-800 dark:text-zinc-200">Type</dt>
          <dd className="mt-1 text-zinc-600 dark:text-zinc-400">
            {listing.type === "auction"
              ? "Auction"
              : listing.type === "fixed_price"
                ? "Fixed price"
                : "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-800 dark:text-zinc-200">
            Price
          </dt>
          <dd className="mt-1 text-zinc-600 dark:text-zinc-400">
            {listing.price_nok != null ? `${listing.price_nok} NOK` : "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-800 dark:text-zinc-200">
            Description
          </dt>
          <dd className="mt-1 whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
            {listing.description?.trim() || "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-800 dark:text-zinc-200">
            Listed
          </dt>
          <dd className="mt-1 text-zinc-600 dark:text-zinc-400">
            {listing.created_at
              ? new Date(listing.created_at).toLocaleString()
              : "—"}
          </dd>
        </div>
        {sellerLabel ? (
          <div>
            <dt className="font-medium text-zinc-800 dark:text-zinc-200">
              Seller
            </dt>
            <dd className="mt-1 text-zinc-600 dark:text-zinc-400">
              {sellerLabel}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
