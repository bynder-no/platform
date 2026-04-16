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

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <h1 className={pageTitleClass}>Profile</h1>
        {user ? (
          <SignedInNavLinks />
        ) : (
          <p className="text-sm">
            <Link
              href="/"
              className="font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
            >
              Home
            </Link>
          </p>
        )}
      </header>

      <dl className={`${pageBodyGapClass} space-y-4 text-sm`}>
        <div>
          <dt className="font-medium text-zinc-800 dark:text-zinc-200">
            Display name
          </dt>
          <dd className="mt-1 text-zinc-600 dark:text-zinc-400">
            {profile.display_name?.trim() || "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-800 dark:text-zinc-200">
            Username
          </dt>
          <dd className="mt-1 text-zinc-600 dark:text-zinc-400">
            {profile.username?.trim() || "—"}
          </dd>
        </div>
      </dl>

      <section className={pageBodyGapClass}>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Active listings
        </h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            No active listings.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
            {rows.map((row) => {
              const rawType =
                typeof row.type === "string" ? row.type.trim() : "";
              const typeLabel =
                rawType === "auction"
                  ? "Auction"
                  : rawType === "fixed_price"
                    ? "Fixed price"
                    : "—";
              const auctionStateLabel =
                rawType === "auction"
                  ? auctionStateLabelNo(
                      nowMs,
                      row.auction_starts_at ?? null,
                      row.auction_ends_at ?? null,
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
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {typeLabel}
                    {auctionStateLabel ? (
                      <>
                        <span className="mx-2 text-zinc-400">·</span>
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          {auctionStateLabel}
                        </span>
                      </>
                    ) : null}
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
    </div>
  );
}
