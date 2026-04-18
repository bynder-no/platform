import Link from "next/link";
import { redirect } from "next/navigation";

import { SignedInNavLinks } from "@/components/signed-in-nav-links";
import { createClient } from "@/lib/supabase/server";
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

import { DeleteDraftForm } from "./delete-draft-form";
import { PublishDraftForm } from "./publish-draft-form";

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
  row: { type: string | null; auction_starts_at: string | null; auction_ends_at: string | null },
  nowMs: number,
): boolean {
  if (row.type !== "auction") return false;
  return (
    auctionTimingLabelNo(nowMs, row.auction_starts_at, row.auction_ends_at) ===
    "Avsluttet"
  );
}

/** Live auction window: started and not yet ended (same instant boundaries as timing label). */
function isAuctionLiveNow(
  row: { type: string | null; auction_starts_at: string | null; auction_ends_at: string | null },
  nowMs: number,
): boolean {
  if (row.type !== "auction") return false;
  const startsAtMs = row.auction_starts_at
    ? new Date(row.auction_starts_at).getTime()
    : Number.NaN;
  const endsAtMs = row.auction_ends_at
    ? new Date(row.auction_ends_at).getTime()
    : Number.NaN;
  if (!Number.isFinite(startsAtMs) || !Number.isFinite(endsAtMs)) return false;
  return nowMs >= startsAtMs && nowMs < endsAtMs;
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

const TRACKED_LIVE_AUCTIONS_LIMIT = 4;

type ListingRow = {
  id: string;
  title: string | null;
  price_nok: number | string | null;
  status: string | null;
  created_at: string | null;
  type: string | null;
  auction_starts_at: string | null;
  auction_ends_at: string | null;
};

type TrackedAuctionListingRow = {
  id: string;
  title: string | null;
  type: string | null;
  auction_starts_at: string | null;
  auction_ends_at: string | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
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
      "id, title, price_nok, status, created_at, type, auction_starts_at, auction_ends_at",
    )
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  if (listingsError) {
    throw new Error(`Could not load listings: ${listingsError.message}`);
  }

  const rows = (listings ?? []) as ListingRow[];
  const now = new Date();
  const nowMs = now.getTime();

  const activeListingsRows = rows.filter((r) => !isAuctionTimeEnded(r, nowMs));

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

  const { data: myBidRows, error: myBidsErr } = await supabase
    .from("bids")
    .select("id, listing_id, amount_nok, created_at")
    .eq("bidder_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (myBidsErr) {
    throw new Error(`Could not load your bids: ${myBidsErr.message}`);
  }

  const myBids = myBidRows ?? [];
  const bidListingIds = [
    ...new Set(
      myBids
        .map((b) => b.listing_id)
        .filter((id): id is string => typeof id === "string" && id !== ""),
    ),
  ];
  const bidListingTitles = new Map<string, string>();
  if (bidListingIds.length > 0) {
    const { data: bidListings, error: bidListErr } = await supabase
      .from("listings")
      .select("id, title")
      .in("id", bidListingIds);

    if (bidListErr) {
      throw new Error(`Could not load listings for bids: ${bidListErr.message}`);
    }
    for (const l of bidListings ?? []) {
      if (l.id) bidListingTitles.set(l.id, String(l.title ?? "").trim() || "—");
    }
  }

  const { data: favoriteRows, error: favoritesError } = await supabase
    .from("favorites")
    .select("listing_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (favoritesError) {
    throw new Error(`Could not load favorites: ${favoritesError.message}`);
  }

  const favList = favoriteRows ?? [];
  const favListingIds = favList
    .map((r) => r.listing_id)
    .filter((id): id is string => typeof id === "string" && id !== "");
  type FavListingLite = { id: string; title: string | null; type: string | null };
  let favListingsOrdered: FavListingLite[] = [];
  if (favListingIds.length > 0) {
    const { data: favListings, error: favListErr } = await supabase
      .from("listings")
      .select("id, title, type")
      .in("id", favListingIds);

    if (favListErr) {
      throw new Error(`Could not load favorite listings: ${favListErr.message}`);
    }
    const byId = new Map((favListings ?? []).map((l) => [l.id, l as FavListingLite]));
    favListingsOrdered = favList
      .map((f) => byId.get(f.listing_id))
      .filter((l): l is FavListingLite => Boolean(l));
  }

  const { data: trackedBidRows, error: trackedBidsErr } = await supabase
    .from("bids")
    .select("listing_id")
    .eq("bidder_id", user.id);

  if (trackedBidsErr) {
    throw new Error(`Could not load bids for tracking: ${trackedBidsErr.message}`);
  }

  const { data: trackedFavRows, error: trackedFavErr } = await supabase
    .from("favorites")
    .select("listing_id")
    .eq("user_id", user.id);

  if (trackedFavErr) {
    throw new Error(
      `Could not load favorites for tracking: ${trackedFavErr.message}`,
    );
  }

  const trackedListingIdSet = new Set<string>();
  for (const r of trackedBidRows ?? []) {
    const lid = r.listing_id;
    if (typeof lid === "string" && lid !== "") trackedListingIdSet.add(lid);
  }
  for (const r of trackedFavRows ?? []) {
    const lid = r.listing_id;
    if (typeof lid === "string" && lid !== "") trackedListingIdSet.add(lid);
  }

  let trackedLiveAuctions: TrackedAuctionListingRow[] = [];
  let highestNokTrackedFollow = new Map<string, number>();

  const trackedIds = [...trackedListingIdSet];
  if (trackedIds.length > 0) {
    const { data: trackedAuctionListings, error: trackedListErr } =
      await supabase
        .from("listings")
        .select("id, title, type, auction_starts_at, auction_ends_at")
        .in("id", trackedIds)
        .eq("type", "auction");

    if (trackedListErr) {
      throw new Error(
        `Could not load tracked auction listings: ${trackedListErr.message}`,
      );
    }

    const liveTracked = (trackedAuctionListings ?? []).filter(
      (l): l is TrackedAuctionListingRow =>
        Boolean(l.id) &&
        isAuctionLiveNow(
          {
            type: l.type,
            auction_starts_at: l.auction_starts_at,
            auction_ends_at: l.auction_ends_at,
          },
          nowMs,
        ),
    );

    liveTracked.sort((a, b) => {
      const ea = a.auction_ends_at
        ? new Date(a.auction_ends_at).getTime()
        : Number.POSITIVE_INFINITY;
      const eb = b.auction_ends_at
        ? new Date(b.auction_ends_at).getTime()
        : Number.POSITIVE_INFINITY;
      return ea - eb;
    });

    trackedLiveAuctions = liveTracked.slice(0, TRACKED_LIVE_AUCTIONS_LIMIT);

    const trackedTopIds = trackedLiveAuctions.map((l) => l.id).filter(Boolean);
    if (trackedTopIds.length > 0) {
      const { data: trackedBidAmountRows, error: trackedBidAmtErr } =
        await supabase
          .from("bids")
          .select("listing_id, amount_nok, created_at")
          .in("listing_id", trackedTopIds);

      if (trackedBidAmtErr) {
        throw new Error(
          `Could not load bids for followed auctions: ${trackedBidAmtErr.message}`,
        );
      }
      highestNokTrackedFollow = highestNokByListingId(
        (trackedBidAmountRows ?? []) as BidWithListingId[],
      );
    }
  }

  const auctionCount = rows.filter((r) => r.type === "auction").length;

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
            {row.type === "auction" ? (
              <>
                <span className="mx-2 text-zinc-400">·</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {auctionTimingLabelNo(
                    nowMs,
                    row.auction_starts_at,
                    row.auction_ends_at,
                  )}
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
            <span className="mx-2 text-zinc-400">·</span>
            {row.created_at
              ? new Date(row.created_at).toLocaleString()
              : "—"}
            {row.type === "auction" && row.auction_ends_at ? (
              <>
                <span className="mx-2 text-zinc-400">·</span>
                Slutter{" "}
                {new Date(row.auction_ends_at).toLocaleString()}
              </>
            ) : null}
          </span>
          {row.status === "draft" ? (
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
              {auctionEditDeleteLocked ? null : (
                <>
                  <Link
                    href={`/listings/${row.id}/edit`}
                    className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                  >
                    Rediger
                  </Link>
                  {row.type === "auction" ? null : (
                    <PublishDraftForm listingId={row.id} />
                  )}
                  <DeleteDraftForm listingId={row.id} />
                </>
              )}
            </div>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <h1 className={pageTitleClass}>Dashboard</h1>
        <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            Innlogget som{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {user.email ?? "—"}
            </span>
          </p>
          <p className="font-mono text-xs text-zinc-500 dark:text-zinc-500">
            {user.id}
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
        </p>
      </header>

      <div className={`${pageBodyGapClass} space-y-10`}>
        <section aria-labelledby="dash-followed-auctions-heading">
          <h2
            id="dash-followed-auctions-heading"
            className={sectionHeadingClass}
          >
            Auksjoner du følger
          </h2>
          {trackedLiveAuctions.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Ingen pågående auksjoner her. Legg inn bud eller lagre som favoritt
              for å se live auksjoner du følger.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
              {trackedLiveAuctions.map((row) => {
                const endMs = row.auction_ends_at
                  ? new Date(row.auction_ends_at).getTime()
                  : Number.NaN;
                const endLabel = row.auction_ends_at
                  ? new Date(row.auction_ends_at).toLocaleString()
                  : "—";
                const remaining = Number.isFinite(endMs)
                  ? formatAuctionTimeRemainingNo(endMs, nowMs)
                  : "—";
                const high =
                  highestNokTrackedFollow.get(row.id) ?? 0;
                return (
                  <li
                    key={row.id}
                    className="flex flex-col gap-1 px-3 py-3 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                  >
                    <Link
                      href={`/listings/${row.id}`}
                      className="font-medium text-zinc-900 dark:text-zinc-100"
                    >
                      {row.title?.trim() || "—"}
                    </Link>
                    <div className="flex flex-col gap-1 sm:items-end">
                      <span className="text-zinc-600 dark:text-zinc-400">
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          Live
                        </span>
                        <span className="mx-2 text-zinc-400">·</span>
                        <span className="tabular-nums">
                          {high} NOK
                        </span>
                        <span className="mx-2 text-zinc-400">·</span>
                        Slutter {endLabel}
                        <span className="mx-2 text-zinc-400">·</span>
                        {remaining}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="dash-active-heading">
          <h2 id="dash-active-heading" className={sectionHeadingClass}>
            Mine aktive annonser
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
            Inkluderer utkast og publiserte annonser. Avsluttede auksjoner
            (etter sluttid) vises under «Mine auksjoner».
          </p>
          {activeListingsRows.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Ingen annonser her ennå. Opprett en for å se den her.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
              {activeListingsRows.map((row) => listingItem(row))}
            </ul>
          )}
        </section>

        <section aria-labelledby="dash-auctions-heading">
          <h2 id="dash-auctions-heading" className={sectionHeadingClass}>
            Mine auksjoner
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {auctionCount > 0
              ? `Du har ${auctionCount} auksjonsannonse${auctionCount === 1 ? "" : "r"} som selger (inkl. utkast og avsluttede).`
              : "Du har ingen auksjonsannonser som selger ennå."}{" "}
            Dealrom og fullførte handler finner du på Mine auksjoner.
          </p>
          <p className="mt-3">
            <Link
              href="/my-auctions"
              className="text-sm font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
            >
              Gå til Mine auksjoner →
            </Link>
          </p>
        </section>

        <section aria-labelledby="dash-bids-heading">
          <h2 id="dash-bids-heading" className={sectionHeadingClass}>
            Bud jeg har lagt inn
          </h2>
          {myBids.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Du har ikke lagt inn bud ennå.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
              {myBids.map((b) => {
                const lid = b.listing_id ?? "";
                const title = bidListingTitles.get(lid) ?? "—";
                const amt = Number(b.amount_nok);
                const when = b.created_at
                  ? new Date(b.created_at).toLocaleString()
                  : "—";
                return (
                  <li
                    key={b.id}
                    className="flex flex-col gap-1 px-3 py-3 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                  >
                    <Link
                      href={lid ? `/listings/${lid}` : "#"}
                      className="font-medium text-zinc-900 dark:text-zinc-100"
                    >
                      {title}
                    </Link>
                    <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
                      {Number.isFinite(amt) ? `${amt} NOK` : "—"}
                      <span className="mx-2 text-zinc-400">·</span>
                      {when}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="dash-fav-heading">
          <h2 id="dash-fav-heading" className={sectionHeadingClass}>
            Favoritter
          </h2>
          {favListingsOrdered.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Ingen favoritter ennå. Lagre annonser fra annonsesiden.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
              {favListingsOrdered.map((row) => {
                const rawType =
                  typeof row.type === "string" ? row.type.trim() : "";
                const typeLabel =
                  rawType === "auction"
                    ? "Auksjon"
                    : rawType === "fixed_price"
                      ? "Fastpris"
                      : "—";
                return (
                  <li
                    key={row.id}
                    className="flex flex-col gap-1 px-3 py-3 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                  >
                    <Link
                      href={`/listings/${row.id}`}
                      className="font-medium text-zinc-900 dark:text-zinc-100"
                    >
                      {row.title?.trim() || "—"}
                    </Link>
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {typeLabel}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
