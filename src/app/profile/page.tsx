import Link from "next/link";
import { redirect } from "next/navigation";

import {
  LISTING_CATEGORY_OPTIONS,
  parseListingCategory,
} from "@/app/create/listing-categories";
import { SignedInNavLinks } from "@/components/signed-in-nav-links";
import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";

import { ProfileEditForm } from "./profile-edit-form";
import { DeleteFixedPriceButton } from "./delete-fixed-price-button";

export const dynamic = "force-dynamic";

type ProfilePageProps = {
  searchParams: Promise<{ category?: string | string[] }>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
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
  const sp = await searchParams;
  const selectedCategory = parseListingCategory(sp.category);

  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select("id, title, price_nok, status, created_at, type, category")
    .eq("seller_id", user.id)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });

  if (listingsError) {
    throw new Error(`Could not load listings: ${listingsError.message}`);
  }

  const { data: ratingsReceived, error: ratingsError } = await supabase
    .from("deal_ratings")
    .select("score")
    .eq("to_user_id", user.id);

  if (ratingsError) {
    throw new Error(`Could not load ratings: ${ratingsError.message}`);
  }

  const rows = listings ?? [];
  const fixedPriceRows = rows
    .filter((row) => row.type === "fixed_price" && row.status === "active")
    .filter((row) =>
      selectedCategory == null ? true : row.category === selectedCategory,
    );
  const auctionRows = rows.filter(
    (row) => row.type === "auction" && row.status === "active",
  );

  const ratingScores = (ratingsReceived ?? [])
    .map((r) => Number(r.score))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
  const ratingCount = ratingScores.length;
  let ratingAverageDisplay: string | null = null;
  if (ratingCount > 0) {
    const sum = ratingScores.reduce((a, b) => a + b, 0);
    const avg = sum / ratingCount;
    ratingAverageDisplay = (Math.round(avg * 10) / 10).toFixed(1);
  }

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
  const completedDealsCount = salesCount + purchasesCount;
  const ratingDisplayText =
    ratingCount === 0
      ? "Ingen vurderinger ennå"
      : `${ratingAverageDisplay} av 5 (${ratingCount})`;

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <div className="w-full rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                Min Pokeshop
              </p>
              <h1 className={pageTitleClass}>{defaultDisplayName || "Min profil"}</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                @{defaultUsername || "—"} · Rating: {ratingDisplayText}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950">
                <p className="text-zinc-500 dark:text-zinc-400">
                  Aktive fastprisannonser
                </p>
                <p className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {fixedPriceRows.length}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950">
                <p className="text-zinc-500 dark:text-zinc-400">Aktive auksjoner</p>
                <p className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {auctionRows.length}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950">
                <p className="text-zinc-500 dark:text-zinc-400">Fullførte handler</p>
                <p className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {completedDealsCount}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href="/create"
                className="rounded-md border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                Opprett annonse
              </Link>
              <Link
                href="/my-listings"
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Mine aktive annonser
              </Link>
              <Link
                href="/my-auctions"
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Mine deals
              </Link>
            </div>
          </div>
        </div>
        <SignedInNavLinks />
      </header>

      <ProfileEditForm
        defaultDisplayName={defaultDisplayName}
        defaultUsername={defaultUsername}
      />

      <section className={pageBodyGapClass}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Min butikk
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Produkter med fastpris vises først i butikken din.
            </p>
          </div>
          <Link
            href="/create"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Legg til produkt
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/profile"
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              selectedCategory == null
                ? "border-zinc-400 bg-zinc-900 text-white dark:border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            Alle
          </Link>
          {LISTING_CATEGORY_OPTIONS.map((option) => {
            const active = selectedCategory === option.slug;
            return (
              <Link
                key={option.slug}
                href={`/profile?category=${option.slug}`}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  active
                    ? "border-zinc-400 bg-zinc-900 text-white dark:border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {option.label}
              </Link>
            );
          })}
        </div>
        {fixedPriceRows.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900/60">
            <p className="text-zinc-700 dark:text-zinc-300">
              Hyllene er tomme akkurat nå. Opprett en annonse for aa fylle
              butikken din.
            </p>
            <Link
              href="/create"
              className="mt-2 inline-flex rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Opprett annonse
            </Link>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fixedPriceRows.map((row) => (
              <li
                key={row.id}
                className="rounded-lg border border-zinc-200 bg-white p-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="flex h-full flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      {row.category ?? "Uten kategori"}
                    </p>
                    <Link
                      href={`/listings/${row.id}`}
                      className="line-clamp-2 font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {row.title}
                    </Link>
                    <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      {row.price_nok != null ? `${row.price_nok} NOK` : "Pris mangler"}
                    </p>
                  </div>
                  <Link
                    href={`/listings/${row.id}`}
                    className="inline-flex rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Se produkt
                  </Link>
                  {user.id && row.type === "fixed_price" ? (
                    <Link
                      href={`/listings/${row.id}/edit`}
                      className="inline-flex rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Rediger
                    </Link>
                  ) : null}
                  {user.id && row.type === "fixed_price" ? (
                    <DeleteFixedPriceButton listingId={row.id} />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={pageBodyGapClass}>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Mine aktive auksjoner
        </h2>
        {auctionRows.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Ingen aktive auksjoner akkurat nå.
          </p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {auctionRows.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-1 rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
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
                  {row.price_nok != null ? `${row.price_nok} NOK` : "—"}
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
