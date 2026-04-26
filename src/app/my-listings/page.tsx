import Link from "next/link";
import { redirect } from "next/navigation";

import { SignedInNavLinks } from "@/components/signed-in-nav-links";
import { createClient } from "@/lib/supabase/server";
import { resolvePendingEndedAuctions } from "@/lib/auction-resolution";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";
import {
  highestNokByListingId,
  type BidWithListingId,
} from "@/lib/highest-bid-nok";

import { DeleteDraftForm } from "../dashboard/delete-draft-form";
import { PublishDraftForm } from "../dashboard/publish-draft-form";
import { DeleteFixedPriceForm } from "../listings/[id]/delete-fixed-price-form";

export const dynamic = "force-dynamic";

/** Hide draft Edit/Delete from 1 minute before auction start through after start. */
const AUCTION_EDIT_DELETE_LOCK_MS = 60 * 1000;

const sectionHeadingClass =
  "text-sm font-semibold text-zinc-900 dark:text-zinc-50";

function auctionTimingLabelNo(
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

function isAuctionTimeEnded(
  row: {
    type: string | null;
    auction_starts_at: string | null;
    auction_ends_at: string | null;
  },
  nowMs: number,
): boolean {
  if (row.type !== "auction") return false;
  return (
    auctionTimingLabelNo(nowMs, row.auction_starts_at, row.auction_ends_at) ===
    "Avsluttet"
  );
}

function formatAuctionTimeRemainingNo(endMs: number, nowMs: number): string {
  const ms = endMs - nowMs;
  if (ms <= 0) return "Avsluttet";
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 60) return `${totalMin} min igjen`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours < 24) {
    return mins > 0 ? `${hours} t ${mins} min igjen` : `${hours} t igjen`;
  }
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  return h > 0 ? `${days} d ${h} t igjen` : `${days} d igjen`;
}

type ListingRow = {
  id: string;
  title: string | null;
  price_nok: number | string | null;
  status: string | null;
  type: string | null;
  auction_starts_at: string | null;
  auction_ends_at: string | null;
};

export default async function MyListingsPage() {
  const supabase = await createClient();
  await resolvePendingEndedAuctions(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingProfile) {
    const { error: insertError } = await supabase
      .from("profiles")
      .insert({ id: user.id });

    if (insertError) {
      throw new Error(`Could not create profile: ${insertError.message}`);
    }
  }

  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select(
      "id, title, price_nok, status, type, auction_starts_at, auction_ends_at",
    )
    .eq("seller_id", user.id)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });

  if (listingsError) {
    throw new Error(`Could not load listings: ${listingsError.message}`);
  }

  const rows = (listings ?? []) as ListingRow[];
  const now = new Date();
  const nowMs = now.getTime();

  const activeListingsRows = rows.filter((r) => !isAuctionTimeEnded(r, nowMs));
  const activeAuctionRows = activeListingsRows.filter(
    (r) => r.type === "auction",
  );
  const activeFixedPriceRows = activeListingsRows.filter(
    (r) => r.type === "fixed_price" && r.status === "active",
  );

  const auctionIdsForBids = rows
    .filter((r) => r.type === "auction")
    .map((r) => r.id)
    .filter(Boolean);
  let highestNokByListing = new Map<string, number>();
  if (auctionIdsForBids.length > 0) {
    const { data: bidRows, error: bidsErr } = await supabase
      .from("bids")
      .select("listing_id, amount_nok, created_at")
      .in("listing_id", auctionIdsForBids);

    if (bidsErr) {
      throw new Error(`Could not load bids: ${bidsErr.message}`);
    }
    highestNokByListing = highestNokByListingId(
      (bidRows ?? []) as BidWithListingId[],
    );
  }

  const listingItem = (row: ListingRow) => {
    let auctionEditDeleteLocked = false;
    if (
      row.type === "auction" &&
      row.status === "draft" &&
      row.auction_starts_at != null
    ) {
      const startsAtMs = new Date(row.auction_starts_at).getTime();
      if (Number.isFinite(startsAtMs)) {
        if (startsAtMs > nowMs) {
          auctionEditDeleteLocked =
            nowMs >= startsAtMs - AUCTION_EDIT_DELETE_LOCK_MS;
        }
      }
    }

    const auctionPhase =
      row.type === "auction"
        ? auctionTimingLabelNo(
            nowMs,
            row.auction_starts_at,
            row.auction_ends_at,
          )
        : null;

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
        <div className="flex flex-col gap-2 sm:items-end">
          <span className="text-zinc-600 dark:text-zinc-400">
            {row.type === "auction"
              ? "Auksjon"
              : row.type === "fixed_price"
                ? "Fastpris"
                : "—"}
            {row.type === "auction" && auctionPhase != null ? (
              <>
                <span className="mx-2 text-zinc-400">·</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {auctionPhase}
                </span>
              </>
            ) : null}
            <span className="mx-2 text-zinc-400">·</span>
            {row.type === "auction"
              ? `${highestNokByListing.get(row.id) ?? 0} NOK`
              : row.price_nok != null
                ? `${row.price_nok} NOK`
                : "—"}
            <span className="mx-2 text-zinc-400">·</span>
            {row.status}
          </span>
          {row.type === "auction" &&
          auctionPhase === "Live" &&
          row.auction_ends_at ? (
            <span className="flex flex-col gap-0.5 text-right text-xs text-zinc-500 dark:text-zinc-400">
              <span>
                Slutter {new Date(row.auction_ends_at).toLocaleString()}
              </span>
              <span className="tabular-nums">
                {formatAuctionTimeRemainingNo(
                  new Date(row.auction_ends_at).getTime(),
                  nowMs,
                )}
              </span>
            </span>
          ) : row.type === "auction" &&
            auctionPhase === "Planlagt" &&
            (row.auction_starts_at || row.auction_ends_at) ? (
            <span className="flex flex-col gap-0.5 text-right text-xs text-zinc-500 dark:text-zinc-400">
              {row.auction_starts_at ? (
                <span>
                  Starttid{" "}
                  {new Date(row.auction_starts_at).toLocaleString()}
                </span>
              ) : null}
              {row.auction_ends_at ? (
                <span>
                  Slutter {new Date(row.auction_ends_at).toLocaleString()}
                </span>
              ) : null}
            </span>
          ) : row.type === "auction" &&
            auctionPhase === "Avsluttet" &&
            row.auction_ends_at ? (
            <span className="text-right text-xs text-zinc-500 dark:text-zinc-400">
              Sluttet {new Date(row.auction_ends_at).toLocaleString()}
            </span>
          ) : null}
          {row.type === "auction" && row.status === "draft" ? (
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
              {auctionEditDeleteLocked ? null : (
                <>
                  <Link
                    href={`/listings/${row.id}/edit`}
                    className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                  >
                    Rediger
                  </Link>
                  <PublishDraftForm listingId={row.id} />
                  <DeleteDraftForm listingId={row.id} />
                </>
              )}
            </div>
          ) : null}
          {row.type === "fixed_price" ? (
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
              <DeleteFixedPriceForm listingId={row.id} returnTo="/my-listings" />
            </div>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <h1 className={pageTitleClass}>Mine aktive annonser</h1>
        <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            Innlogget som{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {user.email ?? "—"}
            </span>
          </p>
        </div>
        <SignedInNavLinks />
        <p className="text-sm">
          <Link
            href="/create"
            className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
          >
            Opprett annonse
          </Link>
          {" · "}
          <Link
            href="/dashboard"
            className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
          >
            Dashboard
          </Link>
        </p>
      </header>

      <div className={`${pageBodyGapClass} space-y-10`}>
        <section aria-labelledby="my-active-auctions-heading">
          <h2 id="my-active-auctions-heading" className={sectionHeadingClass}>
            Mine aktive auksjoner
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
            Inkluderer utkast og publiserte auksjoner. Avsluttede auksjoner (etter
            sluttid) vises under «Mine deals».
          </p>
          {activeAuctionRows.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Ingen aktive auksjoner her ennå.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
              {activeAuctionRows.map((row) => listingItem(row))}
            </ul>
          )}
        </section>

        <section aria-labelledby="my-active-fixed-heading">
          <h2 id="my-active-fixed-heading" className={sectionHeadingClass}>
            Mine aktive fastprisannonser
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
            Viser aktive fastprisannonser.
          </p>
          {activeFixedPriceRows.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Ingen aktive fastprisannonser her ennå.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
              {activeFixedPriceRows.map((row) => listingItem(row))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
