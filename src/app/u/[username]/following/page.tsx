import Link from "next/link";
import { notFound } from "next/navigation";

import { SignedInNavLinks } from "@/components/signed-in-nav-links";
import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ username: string }>;
};

type FollowProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  active_title: string | null;
};

export default async function FollowingUsersPage({ params }: PageProps) {
  const { username: usernameParam } = await params;
  const username = decodeURIComponent(usernameParam).trim();
  if (!username) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .eq("username", username)
    .maybeSingle();

  if (profileError) throw new Error(`Could not load profile: ${profileError.message}`);
  if (!profile) notFound();

  const { data: followRows, error: followsError } = await supabase
    .from("user_follows")
    .select("following_id, created_at")
    .eq("follower_id", profile.id)
    .order("created_at", { ascending: false });

  if (followsError) throw new Error(`Could not load following users: ${followsError.message}`);

  const followingIds = Array.from(
    new Set(
      (followRows ?? [])
        .map((row) => String(row.following_id ?? "").trim())
        .filter((id) => id !== ""),
    ),
  );

  let followingProfiles: FollowProfileRow[] = [];
  const ratingByUserId = new Map<string, string>();

  if (followingIds.length > 0) {
    const { data: followingRows, error: followingProfilesError } = await supabase
      .from("profiles")
      .select("id, username, display_name, active_title")
      .in("id", followingIds);

    if (followingProfilesError) {
      throw new Error(`Could not load followed profiles: ${followingProfilesError.message}`);
    }

    const byId = new Map(
      ((followingRows ?? []) as FollowProfileRow[]).map((row) => [String(row.id), row]),
    );
    followingProfiles = followingIds
      .map((id) => byId.get(id))
      .filter((row): row is FollowProfileRow => row != null);

    const { data: ratingRows, error: ratingsError } = await supabase
      .from("deal_ratings")
      .select("to_user_id, score")
      .in("to_user_id", followingIds);
    if (ratingsError) throw new Error(`Could not load followed user ratings: ${ratingsError.message}`);

    const scoresByUserId = new Map<string, number[]>();
    for (const row of ratingRows ?? []) {
      const toUserId = String(row.to_user_id ?? "").trim();
      const score = Number(row.score);
      if (!toUserId || !Number.isFinite(score) || score < 1 || score > 5) continue;
      const scores = scoresByUserId.get(toUserId) ?? [];
      scores.push(score);
      scoresByUserId.set(toUserId, scores);
    }
    for (const [toUserId, scores] of scoresByUserId.entries()) {
      const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      ratingByUserId.set(toUserId, `${(Math.round(avg * 10) / 10).toFixed(1)} (${scores.length})`);
    }
  }

  const profileLabel =
    String(profile.display_name ?? "").trim() || String(profile.username ?? "").trim() || "Bruker";

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
          <h1 className={pageTitleClass}>Følger</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{profileLabel}</p>
        </div>
      </header>

      <section className={pageBodyGapClass}>
        {followingProfiles.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Følger ingen ennå.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-900">
            {followingProfiles.map((row) => {
              const rowUsername = String(row.username ?? "").trim();
              const rowDisplayName = String(row.display_name ?? "").trim();
              const rowActiveTitle = String(row.active_title ?? "").trim();
              const rowLabel = rowDisplayName || rowUsername || "Bruker";
              const rowHref =
                rowUsername !== "" ? `/u/${encodeURIComponent(rowUsername)}` : null;
              const rating = ratingByUserId.get(String(row.id));

              return (
                <li key={row.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      {rowHref ? (
                        <Link
                          href={rowHref}
                          className="truncate font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                        >
                          {rowLabel}
                        </Link>
                      ) : (
                        <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                          {rowLabel}
                        </p>
                      )}
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        @{rowUsername || "—"}
                        {rowActiveTitle ? ` · ${rowActiveTitle}` : ""}
                        {rating ? ` · Rating ${rating}` : ""}
                      </p>
                    </div>
                    {rowHref ? (
                      <Link
                        href={rowHref}
                        className="shrink-0 text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-300"
                      >
                        Vis profil
                      </Link>
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
