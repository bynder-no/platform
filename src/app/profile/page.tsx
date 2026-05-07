import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";

import {
  LISTING_CATEGORY_OPTIONS,
  parseListingCategory,
} from "@/app/create/listing-categories";
import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
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
    <div className="min-h-screen bg-zinc-50">
      <div className={pageShellClass}>
        <header className={pageHeaderClass}>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
              <div className="min-w-0 space-y-1 lg:max-w-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  Min Pokeshop
                </p>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
                  {defaultDisplayName || "Min profil"}
                </h1>
                <p className="text-sm text-zinc-600">{activeTitle}</p>
                <p className="text-sm text-zinc-500">@{defaultUsername || "—"}</p>
                <div className="pt-2">
                  {ratingCount === 0 ? (
                    <p className="text-sm text-zinc-500">{ratingDisplayText}</p>
                  ) : (
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-2xl font-bold tabular-nums text-zinc-900">
                        {ratingAverageDisplay ?? "—"}
                      </span>
                      <span className="text-sm text-zinc-500">
                        av 5 · {ratingCount}{" "}
                        {ratingCount === 1 ? "vurdering" : "vurderinger"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 lg:gap-2">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                  <p className="text-zinc-500">Følgere</p>
                  <p className="font-semibold tabular-nums text-zinc-900">
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
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                  <p className="text-zinc-500">Følger</p>
                  <p className="font-semibold tabular-nums text-zinc-900">
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
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                  <p className="text-zinc-500">Aktive fastprisannonser</p>
                  <p className="font-semibold tabular-nums text-zinc-900">
                    {fixedPriceRows.length}
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                  <p className="text-zinc-500">Aktive auksjoner</p>
                  <p className="font-semibold tabular-nums text-zinc-900">
                    {auctionRows.length}
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                  <p className="text-zinc-500">Fullførte handler</p>
                  <p className="font-semibold tabular-nums text-zinc-900">
                    {completedDealsCount}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:w-56 lg:flex-col lg:flex-nowrap">
                <Link
                  href="/create"
                  className="inline-flex justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                  Opprett annonse
                </Link>
                <Link
                  href="/my-listings"
                  className="inline-flex justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100"
                >
                  Mine aktive annonser
                </Link>
                <Link
                  href="/favorites"
                  className="inline-flex justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100"
                >
                  Favorites
                </Link>
                <Link
                  href="/settings"
                  className="inline-flex justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100"
                >
                  Innstillinger
                </Link>
              </div>
            </div>
          </div>
        </header>

      <section className={pageBodyGapClass}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">{shopHeading}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Produkter med fastpris vises først i butikken din.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/profile"
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              selectedCategory == null
                ? "border-blue-300 bg-blue-50 text-blue-900"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
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
                    ? "border-blue-300 bg-blue-50 text-blue-900"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {option.label}
              </Link>
            );
          })}
        </div>
        {fixedPriceRows.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm">
            <p className="text-zinc-700">
              Hyllene er tomme akkurat nå. Opprett en annonse for aa fylle
              butikken din.
            </p>
            <Link
              href="/create"
              className="mt-2 inline-flex justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Opprett annonse
            </Link>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fixedPriceRows.map((row) => (
              <li
                key={row.id}
                className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white text-sm shadow-sm"
              >
                <div className="relative -mx-px -mt-px aspect-[16/9] w-[calc(100%+2px)] max-h-44 shrink-0 overflow-hidden bg-zinc-100">
                  {normalizeListingImageUrls(row.image_urls)[0] ? (
                    <Image
                      src={normalizeListingImageUrls(row.image_urls)[0]}
                      alt={row.title ?? "Annonsebilde"}
                      width={320}
                      height={180}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full min-h-[9rem] w-full items-center justify-center border-b border-dashed border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
                      Ingen bilde
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-3">
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      {row.category ?? "Uten kategori"}
                    </p>
                    <Link
                      href={`/listings/${row.id}`}
                      className="line-clamp-2 font-semibold text-zinc-900 hover:underline"
                    >
                      {row.title}
                    </Link>
                    <p className="text-base font-semibold text-zinc-900">
                      {row.price_nok != null ? `${row.price_nok} NOK` : "Pris mangler"}
                    </p>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-3">
                    <Link
                      href={`/listings/${row.id}`}
                      className="inline-flex rounded-lg border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-900 transition hover:bg-zinc-100"
                    >
                      Se produkt
                    </Link>
                    {user.id && row.type === "fixed_price" ? (
                      <Link
                        href={`/listings/${row.id}/edit`}
                        className="inline-flex rounded-lg border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-900 transition hover:bg-zinc-100"
                      >
                        Rediger
                      </Link>
                    ) : null}
                    {user.id && row.type === "fixed_price" ? (
                      <span className="inline-flex [&_button]:!rounded-lg [&_button]:!border [&_button]:!border-red-200 [&_button]:!bg-red-50 [&_button]:!px-3 [&_button]:!py-1.5 [&_button]:!text-xs [&_button]:!font-medium [&_button]:!text-red-600 [&_button]:!shadow-none [&_button]:transition [&_button]:hover:!bg-red-100">
                        <DeleteFixedPriceButton listingId={row.id} />
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </div>
  );
}
