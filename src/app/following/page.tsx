import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";

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

type FollowingListingRow = {
  id: string;
  title: string | null;
  type: string | null;
  price_nok: number | null;
  image_urls: unknown;
  seller_id: string | null;
  created_at: string | null;
};

export default async function FollowingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error: publishDueError } = await supabase.rpc("publish_due_auctions");
  if (publishDueError) {
    console.error("publish_due_auctions:", publishDueError.message);
  }

  const { data: followRows, error: followsError } = await supabase
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", user.id);

  if (followsError) {
    throw new Error(`Could not load follows: ${followsError.message}`);
  }

  const followingIds = (followRows ?? [])
    .map((row) => String(row.following_id ?? "").trim())
    .filter((id) => id !== "");

  let listings: FollowingListingRow[] = [];
  const sellerUsernameById = new Map<string, string>();

  if (followingIds.length > 0) {
    const nowIso = new Date().toISOString();
    const { data: listingRows, error: listingsError } = await supabase
      .from("listings")
      .select("id, title, type, price_nok, image_urls, seller_id, created_at")
      .in("seller_id", followingIds)
      .or(publicListingFeedOrFilter(nowIso))
      .order("created_at", { ascending: false });

    if (listingsError) {
      throw new Error(`Could not load following listings: ${listingsError.message}`);
    }

    listings = (listingRows ?? []) as FollowingListingRow[];

    const sellerIds = [
      ...new Set(
        listings
          .map((row) => String(row.seller_id ?? "").trim())
          .filter((id) => id !== ""),
      ),
    ];

    if (sellerIds.length > 0) {
      const { data: sellerRows, error: sellerError } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", sellerIds);

      if (sellerError) {
        throw new Error(`Could not load seller profiles: ${sellerError.message}`);
      }

      for (const seller of sellerRows ?? []) {
        const sellerId = String(seller.id ?? "").trim();
        const username = String(seller.username ?? "").trim();
        if (sellerId !== "" && username !== "") {
          sellerUsernameById.set(sellerId, username);
        }
      }
    }
  }

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <h1 className={pageTitleClass}>Følger</h1>
        <SignedInNavLinks />
      </header>

      <section className={pageBodyGapClass}>
        {followingIds.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Du følger ingen ennå. Gå til en offentlig profil for å følge brukere.
          </p>
        ) : listings.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Ingen aktive annonser fra brukere du følger akkurat nå.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((row) => {
              const sellerId = String(row.seller_id ?? "").trim();
              const sellerUsername = sellerUsernameById.get(sellerId);
              const sellerHref =
                sellerUsername != null
                  ? `/u/${encodeURIComponent(sellerUsername)}`
                  : null;
              const typeLabel =
                row.type === "auction"
                  ? "Auksjon"
                  : row.type === "fixed_price"
                    ? "Fastpris"
                    : "Annonse";
              const coverImage = normalizeListingImageUrls(row.image_urls)[0] ?? null;
              return (
                <li
                  key={row.id}
                  className="rounded-lg border border-zinc-200 bg-white p-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <div className="flex h-full flex-col gap-3">
                    {coverImage ? (
                      <Image
                        src={coverImage}
                        alt={row.title?.trim() || "Annonsebilde"}
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
                        {typeLabel}
                      </p>
                      <Link
                        href={`/listings/${row.id}`}
                        className="line-clamp-2 font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
                      >
                        {row.title?.trim() || "—"}
                      </Link>
                      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                        {row.price_nok != null ? `${row.price_nok} NOK` : "Pris mangler"}
                      </p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        Selger:{" "}
                        {sellerHref ? (
                          <Link href={sellerHref} className="hover:underline">
                            {sellerUsername}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </p>
                    </div>
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
