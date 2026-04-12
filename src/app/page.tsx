import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const inputClass =
  "min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";

const buttonClass =
  "rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

type PageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const rawQ = sp.q;
  const q =
    typeof rawQ === "string"
      ? rawQ.trim()
      : Array.isArray(rawQ) && rawQ[0]
        ? String(rawQ[0]).trim()
        : "";

  const supabase = await createClient();

  let query = supabase
    .from("listings")
    .select("id, title, type, price_nok, status, created_at")
    .eq("status", "active");

  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  const { data: listings, error } = await query.order("created_at", {
    ascending: false,
  });

  if (error) {
    throw new Error(`Could not load listings: ${error.message}`);
  }

  const rows = listings ?? [];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-16">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Listings
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Public feed of all listings.
      </p>

      <form
        method="get"
        action="/"
        className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <label className="sr-only" htmlFor="listing-search-q">
          Search listings by title
        </label>
        <input
          id="listing-search-q"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by title"
          className={inputClass}
        />
        <button type="submit" className={buttonClass}>
          Search
        </button>
      </form>

      {q ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          {`Showing results for "${q}"`}{" "}
          <Link
            href="/"
            className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
          >
            Clear
          </Link>
        </p>
      ) : null}

      <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <Link
          href="/login"
          className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
        >
          Login
        </Link>
        <Link
          href="/signup"
          className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
        >
          Signup
        </Link>
        <Link
          href="/dashboard"
          className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
        >
          Dashboard
        </Link>
      </nav>

      <section className="mt-10">
        {rows.length === 0 ? (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            <p className="font-medium text-zinc-800 dark:text-zinc-200">
              {q ? "No matching listings" : "No listings yet"}
            </p>
            <p className="mt-2">
              {q
                ? "Try a different search or clear the field and search again."
                : "The feed is empty. Check back later."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
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
                  className="flex flex-col gap-1 px-3 py-3 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                >
                  <Link
                    href={`/listings/${row.id}`}
                    className="font-medium text-zinc-900 dark:text-zinc-100"
                  >
                    {row.title}
                  </Link>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {typeLabel}
                    <span className="mx-2 text-zinc-400">·</span>
                    {row.price_nok != null ? `${row.price_nok} NOK` : "—"}
                    <span className="mx-2 text-zinc-400">·</span>
                    {row.status}
                    <span className="mx-2 text-zinc-400">·</span>
                    {row.created_at
                      ? new Date(row.created_at).toLocaleString()
                      : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
