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

import { DeleteDraftForm } from "./delete-draft-form";
import { PublishDraftForm } from "./publish-draft-form";

export const dynamic = "force-dynamic";

/** Hide draft Edit/Delete from 1 minute before auction start through after start. */
const AUCTION_EDIT_DELETE_LOCK_MS = 60 * 1000;

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
    .select("id, title, price_nok, status, created_at, type, auction_starts_at, auction_ends_at")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  if (listingsError) {
    throw new Error(`Could not load listings: ${listingsError.message}`);
  }

  const rows = listings ?? [];
  const nowMs = Date.now();

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <h1 className={pageTitleClass}>Dashboard</h1>
        <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            Signed in as{" "}
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
            Create a listing
          </Link>
        </p>
      </header>

      <section className={pageBodyGapClass}>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Your listings
        </h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            No listings yet. Create one to see it here.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
            {rows.map((row) => {
              const startsAtMs =
                row.type === "auction" && row.auction_starts_at
                  ? new Date(row.auction_starts_at).getTime()
                  : NaN;
              const auctionEditDeleteLocked =
                row.type === "auction" &&
                row.auction_starts_at != null &&
                Number.isFinite(startsAtMs) &&
                nowMs >= startsAtMs - AUCTION_EDIT_DELETE_LOCK_MS;

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
                      ? "Auction"
                      : row.type === "fixed_price"
                        ? "Fixed price"
                        : "—"}
                    <span className="mx-2 text-zinc-400">·</span>
                    {row.price_nok != null ? `${row.price_nok} NOK` : "—"}
                    <span className="mx-2 text-zinc-400">·</span>
                    {row.status}
                    <span className="mx-2 text-zinc-400">·</span>
                    {row.created_at
                      ? new Date(row.created_at).toLocaleString()
                      : "—"}
                    {row.type === "auction" && row.auction_ends_at ? (
                      <>
                        <span className="mx-2 text-zinc-400">·</span>
                        Ends{" "}
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
                            Edit
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
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
