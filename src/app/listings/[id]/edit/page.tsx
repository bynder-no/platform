import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

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
    .select("id, title, description, price_nok, type, status, seller_id")
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
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-16">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Edit listing
        </h1>
        <Link
          href={`/listings/${listing.id}`}
          className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
        >
          Back
        </Link>
      </div>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        You can edit this listing while it is a draft.
      </p>

      <EditListingForm
        listingId={listing.id}
        defaultTitle={listing.title}
        defaultDescription={listing.description ?? ""}
        defaultPriceNok={listing.price_nok ?? 0}
        defaultType={listing.type ?? "fixed_price"}
      />
    </div>
  );
}
