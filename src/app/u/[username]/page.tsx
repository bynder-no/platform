import Link from "next/link";
import { notFound } from "next/navigation";

import { HomeCardFavoriteButton } from "@/app/home-card-favorite-button";
import {
  LISTING_CATEGORY_OPTIONS,
  parseListingCategory,
} from "@/app/create/listing-categories";
import {
  followUser,
  startConversationThread,
  unfollowUser,
} from "@/app/u/[username]/actions";
import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";
import { publicListingFeedOrFilter } from "@/app/listings/public-auction-feed-filter";
import { ProfileShopListingCard } from "@/components/profile-shop-listing-card";
import { userPublicLabel } from "@/lib/user-display-name";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ category?: string | string[] }>;
};

export default async function PublicProfilePage({
  params,
  searchParams,
}: PageProps) {
  const { username: usernameParam } = await params;
  const sp = await searchParams;
  const username = decodeURIComponent(usernameParam).trim();
  if (!username) {
    notFound();
  }
  const selectedCategory = parseListingCategory(sp.category);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, display_name, username, shop_name, active_title, sales_count, purchases_count",
    )
    .eq("username", username)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Could not load profile: ${profileError.message}`);
  }

  if (!profile) {
    notFound();
  }
  const [
    { count: followersCountRaw, error: followersCountError },
    { count: followingCountRaw, error: followingCountError },
  ] = await Promise.all([
    supabase
      .from("user_follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profile.id),
    supabase
      .from("user_follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profile.id),
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

  const isOwnProfile = user != null && user.id === profile.id;
  let isFollowingProfile = false;
  if (user && !isOwnProfile) {
    const { data: existingFollow, error: followError } = await supabase
      .from("user_follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("following_id", profile.id)
      .maybeSingle();

    if (followError) {
      throw new Error(`Could not load follow status: ${followError.message}`);
    }
    isFollowingProfile = Boolean(existingFollow);
  }

  const { error: publishDueError } = await supabase.rpc("publish_due_auctions");
  if (publishDueError) {
    console.error("publish_due_auctions:", publishDueError.message);
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select(
      "id, title, price_nok, image_urls, created_at, type, category, status, seller_id, auction_starts_at, auction_ends_at",
    )
    .eq("seller_id", profile.id)
    .or(publicListingFeedOrFilter(nowIso))
    .order("created_at", { ascending: false });

  if (listingsError) {
    throw new Error(`Could not load listings: ${listingsError.message}`);
  }

  const rows = listings ?? [];
  const fixedPriceRows = rows
    .filter((row) => row.type === "fixed_price")
    .filter((row) =>
      selectedCategory == null ? true : row.category === selectedCategory,
    );
  const auctionRows = rows.filter((row) => row.type === "auction");

  const fixedListingIds = fixedPriceRows
    .map((r) => r.id)
    .filter((id): id is string => typeof id === "string" && id !== "");
  const favoriteIdSet = new Set<string>();
  if (user && fixedListingIds.length > 0 && !isOwnProfile) {
    const { data: favRows, error: favErr } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in("listing_id", fixedListingIds);

    if (favErr) {
      throw new Error(`Could not load favorites: ${favErr.message}`);
    }
    for (const r of favRows ?? []) {
      const lid = r.listing_id;
      if (typeof lid === "string" && lid !== "") favoriteIdSet.add(lid);
    }
  }

  const profileBasePath = `/u/${encodeURIComponent(username)}`;
  const favoriteReturnTo =
    selectedCategory == null
      ? profileBasePath
      : `${profileBasePath}?category=${encodeURIComponent(selectedCategory)}`;
  const { data: ratingsReceived, error: ratingsError } = await supabase
    .from("deal_ratings")
    .select("score")
    .eq("to_user_id", profile.id);
  if (ratingsError) {
    throw new Error(`Could not load ratings: ${ratingsError.message}`);
  }
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
  const ratingDisplayText =
    ratingCount === 0
      ? "Ingen vurderinger ennå"
      : `${ratingAverageDisplay} av 5 (${ratingCount})`;
  const salesCountRaw = Number(profile?.sales_count);
  const purchasesCountRaw = Number(profile?.purchases_count);
  const salesCount = Number.isFinite(salesCountRaw)
    ? Math.max(0, Math.trunc(salesCountRaw))
    : 0;
  const purchasesCount = Number.isFinite(purchasesCountRaw)
    ? Math.max(0, Math.trunc(purchasesCountRaw))
    : 0;
  const completedDealsCount = salesCount + purchasesCount;
  const activeTitle = String(profile?.active_title ?? "").trim() || "Kortselger";
  const shopHeading = String(profile?.shop_name ?? "").trim() || "Butikk";
  const publicName = userPublicLabel(
    profile?.username,
    profile?.display_name,
    "—",
  );
  const usernameLabel = String(profile?.username ?? "").trim() || "—";

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        {user ? null : (
          <nav className="flex flex-wrap gap-x-3 gap-y-2 text-sm">
            <Link
              href="/"
              className="font-medium text-zinc-900 underline-offset-2 hover:underline"
            >
              Hjem
            </Link>
            <span className="text-zinc-300" aria-hidden>
              ·
            </span>
            <Link
              href="/login"
              className="font-medium text-zinc-900 underline-offset-2 hover:underline"
            >
              Logg inn
            </Link>
            <span className="text-zinc-300" aria-hidden>
              ·
            </span>
            <Link
              href="/signup"
              className="font-medium text-zinc-900 underline-offset-2 hover:underline"
            >
              Registrer
            </Link>
          </nav>
        )}
        <div className="ui-card w-full p-4">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Min Pokeshop
              </p>
              <h1 className={pageTitleClass}>{publicName}</h1>
              <p className="text-sm text-zinc-600">
                {activeTitle}
              </p>
              <p className="text-sm text-zinc-600">
                @{usernameLabel} · Rating: {ratingDisplayText}
              </p>
              <p className="text-sm text-zinc-600">
                <Link
                  href={`/u/${encodeURIComponent(username)}/followers`}
                  className="hover:underline"
                >
                  Følgere: {followersCount}
                </Link>
                {" · "}
                <Link
                  href={`/u/${encodeURIComponent(username)}/following`}
                  className="hover:underline"
                >
                  Følger: {followingCount}
                </Link>
              </p>
            </div>
            {!isOwnProfile && user ? (
              <div className="flex flex-wrap items-center gap-2">
                <form action={isFollowingProfile ? unfollowUser : followUser}>
                  <input type="hidden" name="followingId" value={profile.id} />
                  <input type="hidden" name="username" value={username} />
                  <button
                    type="submit"
                    className={`inline-flex rounded-md px-3 py-1.5 text-sm font-medium ${
                      isFollowingProfile
                        ? "border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {isFollowingProfile ? "Følger · Slutt å følge" : "Følg"}
                  </button>
                </form>
                <form action={startConversationThread}>
                  <input type="hidden" name="recipientId" value={profile.id} />
                  <button
                    type="submit"
                    className="inline-flex rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    Send melding
                  </button>
                </form>
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                <p className="text-zinc-500">
                  Aktive fastprisannonser
                </p>
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
          </div>
        </div>
      </header>

      <section className={pageBodyGapClass}>
        <h2 className="text-base font-semibold text-zinc-900">
          {shopHeading}
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/u/${encodeURIComponent(username)}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              selectedCategory == null
                ? "border-blue-600 bg-blue-600 text-white"
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
                href={`/u/${encodeURIComponent(username)}?category=${option.slug}`}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  active
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {option.label}
              </Link>
            );
          })}
        </div>
        {fixedPriceRows.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            Ingen aktive fastprisannonser i butikken akkurat nå.
          </p>
        ) : (
          <ul className="mt-4 grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 [&_li]:min-w-0">
            {fixedPriceRows.map((row) => {
              const rowSellerId = String(row.seller_id ?? "").trim();
              const isOwnListing =
                user != null && rowSellerId !== "" && user.id === rowSellerId;
              const canBuy =
                user != null &&
                !isOwnListing &&
                row.type === "fixed_price" &&
                row.status === "active";
              const priceLabel =
                row.price_nok != null
                  ? `Fastpris: ${row.price_nok} NOK`
                  : "Pris mangler";

              return (
                <ProfileShopListingCard
                  key={row.id}
                  listingId={row.id}
                  title={row.title}
                  priceLabel={priceLabel}
                  image_urls={row.image_urls}
                  typeLabel="Fastpris"
                  footerLeft={
                    <>
                      <Link
                        href={`/listings/${row.id}`}
                        className="hover:underline"
                      >
                        Se annonse
                      </Link>
                      {canBuy ? (
                        <Link
                          href={`/listings/${row.id}`}
                          className="hover:underline"
                        >
                          Gi bud
                        </Link>
                      ) : user == null ? (
                        <span className="text-zinc-500">
                          Logg inn for å gi bud
                        </span>
                      ) : null}
                    </>
                  }
                  footerRight={
                    user != null && !isOwnListing ? (
                      <HomeCardFavoriteButton
                        listingId={row.id}
                        isFavorite={favoriteIdSet.has(row.id)}
                        returnTo={favoriteReturnTo}
                      />
                    ) : undefined
                  }
                />
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
