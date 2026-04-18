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

const PAGE_SIZE = 10;

type PageProps = {
  searchParams: Promise<{ offset?: string | string[] }>;
};

type FixedRow = {
  id: string;
  title: string | null;
  price_nok: number | string | null;
  created_at: string | null;
};

function parseOffset(raw: string | string[] | undefined): number {
  const s =
    typeof raw === "string"
      ? raw.trim()
      : Array.isArray(raw) && raw[0]
        ? String(raw[0]).trim()
        : "";
  if (!s) return 0;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0 || n % PAGE_SIZE !== 0) return 0;
  return Math.min(n, 10_000);
}

function priceText(nok: number | string | null) {
  if (nok == null) return "—";
  const n = Number(nok);
  return Number.isFinite(n) ? `${n} NOK` : "—";
}

export default async function PublicFixedPricePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const offset = parseOffset(sp.offset);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: publishDueError } = await supabase.rpc("publish_due_auctions");
  if (publishDueError) {
    console.error("publish_due_auctions:", publishDueError.message);
  }

  const nowIso = new Date().toISOString();

  const selectCols = "id, title, price_nok, created_at";

  const { data: rawListings, error: listingsErr } = await supabase
    .from("listings")
    .select(selectCols)
    .or(publicListingFeedOrFilter(nowIso))
    .eq("type", "fixed_price")
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE);

  if (listingsErr) {
    throw new Error(`Could not load fixed price listings: ${listingsErr.message}`);
  }

  const rawRows = (rawListings ?? []) as FixedRow[];
  const hasMore = rawRows.length > PAGE_SIZE;
  const rows = rawRows.slice(0, PAGE_SIZE);

  const cardClass =
    "flex min-w-[11rem] max-w-[14rem] flex-1 shrink-0 flex-col gap-1 rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900";

  const nextOffset = offset + PAGE_SIZE;
  const nextHref = `/fixed-price?offset=${nextOffset}`;

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <p className="text-sm">
          <Link
            href="/"
            className="font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
          >
            ← Hjem
          </Link>
        </p>
        <div className="space-y-2">
          <h1 className={pageTitleClass}>Fastprisannonser</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Offentlig oversikt over aktive fastprisannonser.
          </p>
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

      <section className={pageBodyGapClass}>
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Ingen fastprisannonser akkurat nå.
          </p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-3">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/listings/${row.id}`}
                    className={`${cardClass} hover:border-zinc-300 dark:hover:border-zinc-600`}
                  >
                    <span className="line-clamp-2 font-medium text-zinc-900 dark:text-zinc-100">
                      {row.title?.trim() || "—"}
                    </span>
                    <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
                      {priceText(row.price_nok)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {hasMore ? (
              <p className="mt-6">
                <Link
                  href={nextHref}
                  className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
                >
                  Se mer
                </Link>
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
