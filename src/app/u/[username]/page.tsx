import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

import {
  LISTING_CATEGORY_OPTIONS,
  parseListingCategory,
} from "@/app/create/listing-categories";
import {
  followUser,
  startConversationThread,
  unfollowUser,
} from "@/app/u/[username]/actions";
import { SignedInNavLinks } from "@/components/signed-in-nav-links";
import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";
import { publicListingFeedOrFilter } from "@/app/listings/public-auction-feed-filter";
import { normalizeListingImageUrls } from "@/lib/listing-images";

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
  const displayName = String(profile?.display_name ?? "").trim() || "—";
  const usernameLabel = String(profile?.username ?? "").trim() || "—";

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        {user ? (
          <SignedInNavLinks />
        ) : (
          <nav className="flex flex-wrap gap-x-3 gap-y-2 text-sm">
            <Link
              href="/"
              className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
            >
              Hjem
            </Link>
            <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
              ·
            </span>
            <Link
              href="/login"
              className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
            >
              Logg inn
            </Link>
            <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
              ·
            </span>
            <Link
              href="/signup"
              className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
            >
              Registrer
            </Link>
          </nav>
        )}
        <div className="ui-card w-full p-4">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                Min Pokeshop
              </p>
              <h1 className={pageTitleClass}>{displayName}</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {activeTitle} {displayName}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                @{usernameLabel} · Rating: {ratingDisplayText}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
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
                        ? "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    }`}
                  >
                    {isFollowingProfile ? "Følger · Slutt å følge" : "Følg"}
                  </button>
                </form>
                <form action={startConversationThread}>
                  <input type="hidden" name="recipientId" value={profile.id} />
                  <button
                    type="submit"
                    className="inline-flex rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Send melding
                  </button>
                </form>
              </div>
            ) : null}
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
          </div>
        </div>
      </header>

      <section className={pageBodyGapClass}>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          {shopHeading}
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/u/${encodeURIComponent(username)}`}
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
                href={`/u/${encodeURIComponent(username)}?category=${option.slug}`}
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
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Ingen aktive fastprisannonser i butikken akkurat nå.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fixedPriceRows.map((row) => {
              const rowSellerId = String(row.seller_id ?? "").trim();
              const isOwnListing = user != null && rowSellerId !== "" && user.id === rowSellerId;
              const canBuy =
                user != null &&
                !isOwnListing &&
                row.type === "fixed_price" &&
                row.status === "active";
              return (
                <li key={row.id} className="ui-card overflow-hidden p-3 text-sm">
                  <div className="flex h-full flex-col justify-between gap-3">
                    {normalizeListingImageUrls(row.image_urls)[0] ? (
                      <Image
                        src={normalizeListingImageUrls(row.image_urls)[0]}
                        alt={row.title ?? "Annonsebilde"}
                        width={320}
                        height={144}
                        unoptimized
                        className="h-40 w-full rounded-xl border border-zinc-200 object-cover dark:border-zinc-700"
                      />
                    ) : (
                      <div className="flex h-40 w-full items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-400">
                        Ingen bilde
                      </div>
                    )}
                    <div className="space-y-1">
                      <span className="ui-badge ui-badge-accent">
                        {row.category ?? "Uten kategori"}
                      </span>
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
                      className="ui-button-secondary inline-flex px-3 py-1.5 text-xs"
                    >
                      Se produkt
                    </Link>
                    {canBuy ? (
                      <Link
                        href={`/listings/${row.id}`}
                        className="ui-button inline-flex px-3 py-1.5 text-xs"
                      >
                        Gi bud
                      </Link>
                    ) : user == null ? (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        Logg inn for å gi bud
                      </p>
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
