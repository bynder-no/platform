import Link from "next/link";
import Image from "next/image";
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
import { normalizeListingImageUrls } from "@/lib/listing-images";

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
    .select(
      "display_name, username, active_title, shop_name, sales_count, purchases_count",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Could not load profile: ${profileError.message}`);
  }
  const [
    { count: followersCountRaw, error: followersCountError },
    { count: followingCountRaw, error: followingCountError },
  ] = await Promise.all([
    supabase
      .from("user_follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", user.id),
    supabase
      .from("user_follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", user.id),
  ]);
  if (followersCountError) {
    throw new Error(`Could not load follower count: ${followersCountError.message}`);
  }
  if (followingCountError) {
    throw new Error(`Could not load following count: ${followingCountError.message}`);
  }
  const followersCount = Number.isFinite(Number(followersCountRaw))
    ? Number(followersCountRaw)
    : 0;
  const followingCount = Number.isFinite(Number(followingCountRaw))
    ? Number(followingCountRaw)
    : 0;
  const sp = await searchParams;
  const selectedCategory = parseListingCategory(sp.category);

  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select("id, title, price_nok, image_urls, status, created_at, type, category")
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
  const defaultUsernamePath =
    defaultUsername !== "" ? encodeURIComponent(defaultUsername) : "";
  const activeTitle = profile?.active_title?.trim() || "Kortselger";

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
  const shopHeading = profile?.shop_name?.trim() || "Min butikk";

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <SignedInNavLinks />
        <div className="overflow-hidden rounded-3xl border border-zinc-200/90 bg-white/90 p-0 shadow-lg shadow-zinc-900/10 ring-1 ring-white/40 backdrop-blur dark:border-zinc-700/80 dark:bg-zinc-900/80 dark:ring-white/5">
          <div className="border-b border-zinc-300/80 bg-gradient-to-r from-red-600 via-red-500 to-orange-500 px-4 py-2 dark:border-zinc-700/70">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-white/30 bg-white/90 px-3 py-1.5 text-zinc-900 shadow-inner dark:border-white/10 dark:bg-zinc-950/80 dark:text-zinc-100">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em]">
                  Bynder Graded Profile Slab
                </p>
                <p className="truncate text-[11px] text-zinc-600 dark:text-zinc-300">
                  @{defaultUsername || "—"} · CERT {user.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <span className="shrink-0 text-[11px] font-semibold">MINT UI</span>
            </div>
          </div>
          <div className="relative space-y-4 bg-white/80 p-4 dark:bg-zinc-900/70">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/55 via-transparent to-sky-100/15 dark:from-white/5 dark:to-sky-500/5"
            />
            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                  Min Pokeshop
                </p>
                <h1 className={pageTitleClass}>{defaultDisplayName || "Min profil"}</h1>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {activeTitle} {defaultDisplayName || "—"}
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  @{defaultUsername || "—"}
                </p>
              </div>
              <div className="shrink-0 rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-center shadow-sm ring-1 ring-zinc-900/5 dark:border-zinc-600 dark:bg-zinc-950 dark:ring-white/5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Grade
                </p>
                <p className="text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {ratingAverageDisplay ?? "—"}
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {ratingCount} vurderinger
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-5">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950">
                <p className="text-zinc-500 dark:text-zinc-400">Følgere</p>
                <p className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {defaultUsernamePath !== "" ? (
                    <Link
                      href={`/u/${defaultUsernamePath}/followers`}
                      className="hover:underline"
                    >
                      {followersCount}
                    </Link>
                  ) : (
                    followersCount
                  )}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950">
                <p className="text-zinc-500 dark:text-zinc-400">Følger</p>
                <p className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                  {defaultUsernamePath !== "" ? (
                    <Link
                      href={`/u/${defaultUsernamePath}/following`}
                      className="hover:underline"
                    >
                      {followingCount}
                    </Link>
                  ) : (
                    followingCount
                  )}
                </p>
              </div>
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
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{ratingDisplayText}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href="/create" className="ui-button inline-flex px-4 py-2">
                Opprett annonse
              </Link>
              <Link href="/my-listings" className="ui-button-secondary inline-flex px-4 py-2">
                Mine aktive annonser
              </Link>
              <Link href="/my-auctions" className="ui-button-secondary inline-flex px-4 py-2">
                Mine deals
              </Link>
              <Link href="/favorites" className="ui-button-secondary inline-flex px-4 py-2">
                Favorites
              </Link>
              <Link href="/settings" className="ui-button-secondary inline-flex px-4 py-2">
                Innstillinger
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className={pageBodyGapClass}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {shopHeading}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Produkter med fastpris vises først i butikken din.
            </p>
          </div>
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
                  {normalizeListingImageUrls(row.image_urls)[0] ? (
                    <Image
                      src={normalizeListingImageUrls(row.image_urls)[0]}
                      alt={row.title ?? "Annonsebilde"}
                      width={320}
                      height={144}
                      unoptimized
                      className="h-36 w-full rounded-md border border-zinc-200 object-cover dark:border-zinc-700"
                    />
                  ) : (
                    <div className="flex h-36 w-full items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-400">
                      Ingen bilde
                    </div>
                  )}
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

    </div>
  );
}
