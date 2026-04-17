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

export const dynamic = "force-dynamic";

type BidRow = {
  listing_id: string;
  amount_nok: number | string | null;
  created_at: string | null;
  bidder_id: string;
};

function leadingBidForListing(bids: BidRow[]): {
  highestNok: number;
  leadingBidderId: string | null;
} {
  let highestNok = 0;
  let leading: BidRow | null = null;
  for (const b of bids) {
    const n = Number(b.amount_nok);
    if (!Number.isFinite(n)) continue;
    if (!leading || n > highestNok) {
      highestNok = n;
      leading = b;
    } else if (n === highestNok && leading) {
      const tNew = b.created_at ? new Date(b.created_at).getTime() : -1;
      const tOld = leading.created_at
        ? new Date(leading.created_at).getTime()
        : -1;
      if (tNew > tOld) leading = b;
    }
  }
  return {
    highestNok,
    leadingBidderId: leading?.bidder_id ?? null,
  };
}

export default async function MyAuctionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const nowIso = new Date().toISOString();

  const { data: sellerListings, error: sellerErr } = await supabase
    .from("listings")
    .select("id, title, auction_ends_at")
    .eq("type", "auction")
    .not("auction_ends_at", "is", null)
    .lte("auction_ends_at", nowIso)
    .eq("seller_id", user.id);

  if (sellerErr) {
    throw new Error(`Could not load auctions: ${sellerErr.message}`);
  }

  const { data: myBidRows, error: myBidsErr } = await supabase
    .from("bids")
    .select("listing_id")
    .eq("bidder_id", user.id);

  if (myBidsErr) {
    throw new Error(`Could not load bids: ${myBidsErr.message}`);
  }

  const sellerIds = new Set((sellerListings ?? []).map((l) => l.id));
  const bidListingIds = [
    ...new Set(
      (myBidRows ?? [])
        .map((r) => r.listing_id)
        .filter((id): id is string => typeof id === "string" && id !== ""),
    ),
  ].filter((id) => !sellerIds.has(id));

  let bidderWinRows: { id: string; title: string | null; auction_ends_at: string | null }[] =
    [];

  if (bidListingIds.length > 0) {
    const { data: bidderCandidates, error: bidderListErr } = await supabase
      .from("listings")
      .select("id, title, auction_ends_at")
      .eq("type", "auction")
      .not("auction_ends_at", "is", null)
      .lte("auction_ends_at", nowIso)
      .in("id", bidListingIds);

    if (bidderListErr) {
      throw new Error(`Could not load auctions: ${bidderListErr.message}`);
    }

    const candidateIds = (bidderCandidates ?? []).map((l) => l.id);
    if (candidateIds.length > 0) {
      const { data: bidRows, error: bidsErr } = await supabase
        .from("bids")
        .select("listing_id, amount_nok, created_at, bidder_id")
        .in("listing_id", candidateIds)
        .order("created_at", { ascending: true });

      if (bidsErr) {
        throw new Error(`Could not load bids: ${bidsErr.message}`);
      }

      const byListing = new Map<string, BidRow[]>();
      for (const b of bidRows ?? []) {
        const lid = b.listing_id;
        if (!lid) continue;
        const arr = byListing.get(lid) ?? [];
        arr.push(b as BidRow);
        byListing.set(lid, arr);
      }

      const won = new Set<string>();
      for (const lid of candidateIds) {
        const { leadingBidderId } = leadingBidForListing(byListing.get(lid) ?? []);
        if (leadingBidderId === user.id) {
          won.add(lid);
        }
      }

      bidderWinRows = (bidderCandidates ?? []).filter((l) => won.has(l.id));
    }
  }

  const merged = new Map<
    string,
    { id: string; title: string | null; auction_ends_at: string | null }
  >();
  for (const l of sellerListings ?? []) {
    merged.set(l.id, l);
  }
  for (const l of bidderWinRows) {
    merged.set(l.id, l);
  }

  const allIds = [...merged.keys()];
  let bidsByListing = new Map<string, BidRow[]>();
  if (allIds.length > 0) {
    const { data: allBids, error: allBidsErr } = await supabase
      .from("bids")
      .select("listing_id, amount_nok, created_at, bidder_id")
      .in("listing_id", allIds)
      .order("created_at", { ascending: true });

    if (allBidsErr) {
      throw new Error(`Could not load bids: ${allBidsErr.message}`);
    }

    for (const b of allBids ?? []) {
      const lid = b.listing_id;
      if (!lid) continue;
      const arr = bidsByListing.get(lid) ?? [];
      arr.push(b as BidRow);
      bidsByListing.set(lid, arr);
    }
  }

  const rows = [...merged.values()].sort((a, b) => {
    const ta = a.auction_ends_at ? new Date(a.auction_ends_at).getTime() : 0;
    const tb = b.auction_ends_at ? new Date(b.auction_ends_at).getTime() : 0;
    return tb - ta;
  });

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <h1 className={pageTitleClass}>Mine auksjoner</h1>
        <SignedInNavLinks />
      </header>

      <section className={pageBodyGapClass}>
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Ingen avsluttede auksjoner der du er selger eller høyeste budgiver.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
            {rows.map((row) => {
              const { highestNok } = leadingBidForListing(
                bidsByListing.get(row.id) ?? [],
              );
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-3 px-3 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {row.title?.trim() || "—"}
                    </p>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      Høyeste bud:{" "}
                      <span className="tabular-nums font-medium text-zinc-800 dark:text-zinc-200">
                        {highestNok > 0 ? highestNok : 0}
                      </span>{" "}
                      NOK
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500">
                      Avsluttet
                    </p>
                  </div>
                  <Link
                    href={`/my-auctions/${row.id}`}
                    className="inline-flex w-fit shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Gå til deal
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
