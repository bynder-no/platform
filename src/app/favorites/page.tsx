import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: favoriteRows, error: favoritesError } = await supabase
    .from("favorites")
    .select("listing_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (favoritesError) {
    throw new Error(`Could not load favorites: ${favoritesError.message}`);
  }

  const favList = favoriteRows ?? [];
  const listingIds = favList.map((r) => r.listing_id);

  type ListingRow = {
    id: string;
    title: string | null;
    type: string | null;
    price_nok: number | null;
    created_at: string | null;
  };

  let rows: ListingRow[] = [];

  if (listingIds.length > 0) {
    const { data: listings, error: listingsError } = await supabase
      .from("listings")
      .select("id, title, type, price_nok, created_at")
      .in("id", listingIds);

    if (listingsError) {
      throw new Error(`Could not load listings: ${listingsError.message}`);
    }

    const byId = new Map((listings ?? []).map((l) => [l.id, l]));
    rows = favList
      .map((f) => byId.get(f.listing_id))
      .filter((l): l is ListingRow => Boolean(l));
  }

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <h1 className={pageTitleClass}>Favorites</h1>
      </header>

      <section className={pageBodyGapClass}>
        {rows.length === 0 ? (
          <div className="text-sm text-zinc-600">
            <p className="font-medium text-zinc-800">
              No favorites yet
            </p>
            <p className="mt-2">
              Save listings from a listing page to see them here.
            </p>
          </div>
        ) : (
          <ul className="ui-card mt-4 divide-y divide-zinc-200 overflow-hidden p-0">
            {rows.map((row) => {
              const rawType =
                typeof row.type === "string" ? row.type.trim() : "";
              const typeLabel =
                rawType === "auction"
                  ? "Auction"
                  : rawType === "fixed_price"
                    ? "Fixed price"
                    : "—";

              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 px-4 py-3 text-sm transition hover:bg-blue-50/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <Link
                    href={`/listings/${row.id}`}
                    className="min-w-0 max-w-full font-semibold text-zinc-900 hover:underline line-clamp-2 overflow-hidden break-words"
                  >
                    {row.title}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 text-xs sm:justify-end">
                    <span className="ui-badge ui-badge-accent">{typeLabel}</span>
                    <span className="tabular-nums text-base font-semibold text-zinc-900">
                      {row.price_nok != null ? `${row.price_nok} NOK` : "—"}
                    </span>
                    <span className="text-zinc-500">
                      {row.created_at
                        ? new Date(row.created_at).toLocaleString()
                        : "—"}
                    </span>
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
