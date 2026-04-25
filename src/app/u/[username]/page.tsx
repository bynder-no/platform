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
import { publicListingFeedOrFilter } from "@/app/listings/public-auction-feed-filter";
import {
  highestNokByListingId,
  type BidWithListingId,
} from "@/lib/highest-bid-nok";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ username: string }>;
};

function auctionStateLabelNo(
  nowMs: number,
  startsAt: string | null,
  endsAt: string | null,
): "Planlagt" | "Live" | "Avsluttet" {
  const startsAtMs = startsAt ? new Date(startsAt).getTime() : Number.NaN;
  const endsAtMs = endsAt ? new Date(endsAt).getTime() : Number.NaN;
  if (Number.isFinite(startsAtMs) && nowMs < startsAtMs) return "Planlagt";
  if (Number.isFinite(endsAtMs) && nowMs >= endsAtMs) return "Avsluttet";
  return "Live";
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username: usernameParam } = await params;
  const username = decodeURIComponent(usernameParam).trim();
  if (!username) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .eq("username", username)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Could not load profile: ${profileError.message}`);
  }

  if (!profile) {
    notFound();
  }

  const { error: publishDueError } = await supabase.rpc("publish_due_auctions");
  if (publishDueError) {
    console.error("publish_due_auctions:", publishDueError.message);
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();
  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select("id, title, price_nok, created_at, type, auction_starts_at, auction_ends_at")
    .eq("seller_id", profile.id)
    .or(publicListingFeedOrFilter(nowIso))
    .order("created_at", { ascending: false });

  if (listingsError) {
    throw new Error(`Could not load listings: ${listingsError.message}`);
  }

  const rows = listings ?? [];
  const fixedPriceRows = rows.filter((row) => row.type === "fixed_price");
  const auctionRows = rows.filter((row) => row.type === "auction");

  const listingIds = auctionRows.map((r) => r.id).filter(Boolean);
  let highestNokByListing = new Map<string, number>();
  if (listingIds.length > 0) {
    const { data: bidRows, error: bidsErr } = await supabase
      .from("bids")
      .select("listing_id, amount_nok, created_at")
      .in("listing_id", listingIds);

    if (bidsErr) {
      throw new Error(`Could not load bids: ${bidsErr.message}`);
    }
    highestNokByListing = highestNokByListingId(
      (bidRows ?? []) as BidWithListingId[],
    );
  }

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Kortselger
          </p>
          <h1 className={pageTitleClass}>{profile.username?.trim() || "—"}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Vurdering: 4,9/5 (kommer snart)
          </p>
        </div>
        {user ? (
          <SignedInNavLinks />
        ) : (
          <p className="text-sm">
            <Link
              href="/"
              className="font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
            >
              Hjem
            </Link>
          </p>
        )}
      </header>

      <section className={pageBodyGapClass}>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Butikk
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-zinc-400 bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900">
            Alle
          </span>
          <span className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300">
            Singelkort
          </span>
          <span className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300">
            PSA/slabs
          </span>
          <span className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300">
            Sealed produkter
          </span>
          <span className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300">
            Bulk / mange kort
          </span>
        </div>
        {fixedPriceRows.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Ingen aktive fastprisannonser i butikken akkurat nå.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
            {fixedPriceRows.map((row) => {
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-1 px-3 py-3 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                >
                  <Link
                    href={`/listings/${row.id}`}
                    className="font-medium text-zinc-900 dark:text-zinc-100"
                  >
                    {row.title}
                  </Link>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Fastpris
                    <span className="mx-2 text-zinc-400">·</span>
                    {row.price_nok != null ? `${row.price_nok} NOK` : "—"}
                    <span className="mx-2 text-zinc-400">·</span>
                    {row.created_at
                      ? new Date(row.created_at).toLocaleString()
                      : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={pageBodyGapClass}>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Auksjoner
        </h2>
        {auctionRows.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Ingen aktive auksjoner akkurat nå.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
            {auctionRows.map((row) => {
              const auctionStateLabel = auctionStateLabelNo(
                nowMs,
                row.auction_starts_at ?? null,
                row.auction_ends_at ?? null,
              );

              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-1 px-3 py-3 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                >
                  <Link
                    href={`/listings/${row.id}`}
                    className="font-medium text-zinc-900 dark:text-zinc-100"
                  >
                    {row.title}
                  </Link>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Auksjon
                    <span className="mx-2 text-zinc-400">·</span>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">
                      {auctionStateLabel}
                    </span>
                    <span className="mx-2 text-zinc-400">·</span>
                    {highestNokByListing.get(row.id) ?? 0} NOK
                    <span className="mx-2 text-zinc-400">·</span>
                    {row.created_at
                      ? new Date(row.created_at).toLocaleString()
                      : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
