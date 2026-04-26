import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

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
import { publicListingFeedOrFilter } from "@/app/listings/public-auction-feed-filter";
import { startFixedPricePurchase } from "@/app/listings/[id]/actions";
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
        <div className="w-full rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
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
                    {canBuy ? (
                      <form action={startFixedPricePurchase}>
                        <input type="hidden" name="listing_id" value={row.id} />
                        <button
                          type="submit"
                          className="inline-flex rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                        >
                          Kjøp
                        </button>
                      </form>
                    ) : user == null ? (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        Logg inn for å kjøpe
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
