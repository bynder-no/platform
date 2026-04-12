import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
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
    .select("display_name, username")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Could not load profile: ${profileError.message}`);
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
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Profile
        </h1>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
        >
          Dashboard
        </Link>
      </div>

      <dl className="mt-8 space-y-4 text-sm">
        <div>
          <dt className="font-medium text-zinc-800 dark:text-zinc-200">
            Display name
          </dt>
          <dd className="mt-1 text-zinc-600 dark:text-zinc-400">
            {profile?.display_name?.trim() || "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-800 dark:text-zinc-200">
            Username
          </dt>
          <dd className="mt-1 text-zinc-600 dark:text-zinc-400">
            {profile?.username?.trim() || "—"}
          </dd>
        </div>
      </dl>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Your listings
        </h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            No listings yet.
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
