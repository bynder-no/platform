import Link from "next/link";

import { SignedInNavLinks } from "@/components/signed-in-nav-links";
import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";
import {
  DiscoverGrid,
} from "@/app/discover/discover-grid";
import {
  DISCOVER_BATCH_SIZE,
  getDiscoverShuffledItems,
} from "@/app/discover/discover-data";

export const dynamic = "force-dynamic";

type DiscoverPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
};

function parseQuery(input: string | string[] | undefined) {
  return typeof input === "string" ? input.trim() : "";
}

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sp = await searchParams;
  const query = parseQuery(sp.q);
  const seed = crypto.randomUUID();
  const shuffledItems = await getDiscoverShuffledItems({
    seed,
    viewerUserId: user?.id ?? null,
  });

  let userResults: ProfileRow[] = [];
  if (query !== "") {
    const q = query.replace(/[%_]/g, "").slice(0, 60);
    if (q !== "") {
      const { data: usersByUsername, error: usernameSearchError } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .ilike("username", `%${q}%`)
        .limit(8);
      if (usernameSearchError) {
        throw new Error(`Could not search users by username: ${usernameSearchError.message}`);
      }

      const { data: usersByDisplay, error: displaySearchError } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .ilike("display_name", `%${q}%`)
        .limit(8);
      if (displaySearchError) {
        throw new Error(`Could not search users by display name: ${displaySearchError.message}`);
      }

      const combined = [...(usersByUsername ?? []), ...(usersByDisplay ?? [])];
      const deduped = new Map<string, ProfileRow>();
      for (const row of combined) {
        const id = String(row.id ?? "").trim();
        const username = String(row.username ?? "").trim();
        if (!id || !username) continue;
        deduped.set(id, {
          id,
          username,
          display_name: row.display_name,
        });
      }
      userResults = Array.from(deduped.values()).slice(0, 12);
    }
  }

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
          </nav>
        )}
        <div>
          <h1 className={pageTitleClass}>Discover</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Utforsk aktive annonser fra alle brukere.
          </p>
        </div>
      </header>

      <section className={pageBodyGapClass}>
        <form method="get" className="space-y-2">
          <label
            htmlFor="discover-user-search"
            className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
          >
            Finn brukere
          </label>
          <div className="flex gap-2">
            <input
              id="discover-user-search"
              name="q"
              defaultValue={query}
              placeholder="Søk etter brukernavn eller navn"
              className="ui-input w-full"
            />
            <button
              type="submit"
              className="ui-button"
            >
              Søk
            </button>
          </div>
        </form>

        {query !== "" ? (
          <div className="ui-card p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Brukere
            </p>
            {userResults.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Ingen brukere funnet.</p>
            ) : (
              <ul className="space-y-2">
                {userResults.map((profile) => {
                  const username = String(profile.username ?? "").trim();
                  const displayName = String(profile.display_name ?? "").trim();
                  return (
                    <li key={profile.id}>
                      <Link
                        href={`/u/${encodeURIComponent(username)}`}
                        className="block rounded-md px-2 py-1.5 text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <span className="font-medium">{displayName || username}</span>
                        <span className="text-zinc-500 dark:text-zinc-400"> @{username}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        {shuffledItems.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Ingen aktive annonser akkurat nå.
          </p>
        ) : (
          <DiscoverGrid
            allItems={shuffledItems}
            batchSize={DISCOVER_BATCH_SIZE}
          />
        )}
      </section>
    </div>
  );
}
