import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
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

  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select("id, title, price_nok, status, created_at")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  if (listingsError) {
    throw new Error(`Could not load listings: ${listingsError.message}`);
  }

  const rows = listings ?? [];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-16">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Dashboard
      </h1>
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        Signed in as{" "}
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {user.email ?? "—"}
        </span>
      </p>
      <p className="mt-2 font-mono text-xs text-zinc-500 dark:text-zinc-500">
        {user.id}
      </p>
      <p className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <Link
          href="/profile"
          className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
        >
          Profile
        </Link>
        <Link
          href="/create"
          className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
        >
          Create a listing
        </Link>
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Your listings
        </h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            No listings yet. Create one to see it here.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
            {rows.map((row) => (
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
                  {row.price_nok != null ? `${row.price_nok} NOK` : "—"}
                  <span className="mx-2 text-zinc-400">·</span>
                  {row.status}
                  <span className="mx-2 text-zinc-400">·</span>
                  {row.created_at
                    ? new Date(row.created_at).toLocaleString()
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
