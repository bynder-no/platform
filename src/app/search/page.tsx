import Link from "next/link";

import { SignedInNavLinks } from "@/components/signed-in-nav-links";
import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";
import { publicListingFeedOrFilter } from "@/app/listings/public-auction-feed-filter";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string | string[];
  }>;
};

type SearchListingRow = {
  id: string;
  title: string | null;
  description: string | null;
  type: string | null;
  price_nok: number | string | null;
  created_at: string | null;
  seller_id: string | null;
};

function sellerUsernameLink(
  sellerId: string | null,
  usernameBySellerId: Map<string, string>,
  viewerUserId: string | null,
) {
  const username = sellerId ? usernameBySellerId.get(sellerId) : undefined;
  if (!username) {
    return <span className="text-zinc-400 dark:text-zinc-500">—</span>;
  }
  const href =
    viewerUserId != null &&
    sellerId != null &&
    viewerUserId === sellerId
      ? "/profile"
      : `/u/${encodeURIComponent(username)}`;
  return (
    <Link
      href={href}
      className="font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
    >
      {username}
    </Link>
  );
}

function priceText(nok: number | string | null) {
  if (nok == null) return "—";
  const n = Number(nok);
  return Number.isFinite(n) ? `${n} NOK` : "—";
}

function normalizeQuery(raw: string | string[] | undefined) {
  const value =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw) && raw[0]
        ? String(raw[0])
        : "";
  return value.trim();
}

function escapeIlikeValue(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams;
  const query = normalizeQuery(sp.q);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let rows: SearchListingRow[] = [];
  if (query !== "") {
    const nowIso = new Date().toISOString();
    const queryPattern = `%${escapeIlikeValue(query)}%`;
    const textSearchOr = `title.ilike.${queryPattern},description.ilike.${queryPattern}`;

    const { data, error } = await supabase
      .from("listings")
      .select("id, title, description, type, price_nok, created_at, seller_id")
      .or(publicListingFeedOrFilter(nowIso))
      .in("type", ["auction", "fixed_price"])
      .or(textSearchOr)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`Could not load search results: ${error.message}`);
    }
    rows = (data ?? []) as SearchListingRow[];
  }

  const sellerIds = [
    ...new Set(
      rows
        .map((row) => row.seller_id)
        .filter((id): id is string => typeof id === "string" && id !== ""),
    ),
  ];
  const sellerUsernameById = new Map<string, string>();
  if (sellerIds.length > 0) {
    const { data: sellerProfiles, error: sellerProfilesError } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", sellerIds);
    if (sellerProfilesError) {
      throw new Error(
        `Could not load seller profiles: ${sellerProfilesError.message}`,
      );
    }
    for (const profile of sellerProfiles ?? []) {
      const username =
        typeof profile.username === "string" ? profile.username.trim() : "";
      if (profile.id && username !== "") {
        sellerUsernameById.set(profile.id, username);
      }
    }
  }

  const cardClass =
    "rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900";

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <div className="space-y-2">
          <p className="text-sm">
            <Link
              href="/"
              className="font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
            >
              ← Hjem
            </Link>
          </p>
          <h1 className={pageTitleClass}>Søk</h1>
        </div>
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
      </header>

      <div className={`${pageBodyGapClass} space-y-8`}>
        <section aria-labelledby="search-form-heading">
          <h2
            id="search-form-heading"
            className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Finn annonser
          </h2>
          <form action="/search" method="get" className="mt-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="search"
                name="q"
                placeholder="Hva leter du etter?"
                defaultValue={query}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 placeholder:text-zinc-500 focus-visible:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-400"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                Søk
              </button>
            </div>
          </form>
        </section>

        <section aria-labelledby="search-results-heading">
          <h2
            id="search-results-heading"
            className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Resultater
          </h2>
          {query === "" ? (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Søk etter Pokémon-kort, sealed produkter, slabs eller bulk.
            </p>
          ) : (
            <>
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                {rows.length} treff for{" "}
                <span className="font-medium">“{query}”</span>.
              </p>
              {rows.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                  Ingen annonser matcher søket akkurat nå.
                </p>
              ) : (
                <ul className="mt-4 grid gap-3">
                  {rows.map((row) => (
                    <li key={row.id} className={cardClass}>
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/listings/${row.id}`}
                          className="line-clamp-2 font-medium text-zinc-900 no-underline outline-none ring-zinc-400 hover:underline focus-visible:ring-2 dark:text-zinc-100"
                        >
                          {row.title?.trim() || "—"}
                        </Link>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {sellerUsernameLink(
                            row.seller_id,
                            sellerUsernameById,
                            user?.id ?? null,
                          )}
                        </p>
                        {row.description?.trim() ? (
                          <p className="line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">
                            {row.description.trim()}
                          </p>
                        ) : null}
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                          {row.type === "fixed_price"
                            ? `Fastpris - ${priceText(row.price_nok)}`
                            : "Auksjon"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
