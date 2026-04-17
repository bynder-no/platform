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

import { ProfileEditForm } from "./profile-edit-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, username, sales_count, purchases_count")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Could not load profile: ${profileError.message}`);
  }

  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select("id, title, price_nok, status, created_at, type")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  if (listingsError) {
    throw new Error(`Could not load listings: ${listingsError.message}`);
  }

  const rows = listings ?? [];

  const defaultDisplayName = profile?.display_name?.trim() ?? "";
  const defaultUsername = profile?.username?.trim() ?? "";

  const salesCountRaw = Number(profile?.sales_count);
  const purchasesCountRaw = Number(profile?.purchases_count);
  const salesCount = Number.isFinite(salesCountRaw)
    ? Math.max(0, Math.trunc(salesCountRaw))
    : 0;
  const purchasesCount = Number.isFinite(purchasesCountRaw)
    ? Math.max(0, Math.trunc(purchasesCountRaw))
    : 0;

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <h1 className={pageTitleClass}>Profile</h1>
        <SignedInNavLinks />
      </header>

      <ProfileEditForm
        defaultDisplayName={defaultDisplayName}
        defaultUsername={defaultUsername}
      />

      <section className={pageBodyGapClass}>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <span className="block">
            Antall salg:{" "}
            <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
              {salesCount}
            </span>
          </span>
          <span className="mt-1 block">
            Antall kjøp:{" "}
            <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
              {purchasesCount}
            </span>
          </span>
        </p>
      </section>

      <section className={pageBodyGapClass}>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Your listings
        </h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            No listings yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
            {rows.map((row) => (
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
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
