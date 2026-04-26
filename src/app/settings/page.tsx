import Link from "next/link";
import { redirect } from "next/navigation";

import { SignedInNavLinks } from "@/components/signed-in-nav-links";
import {
  PROFILE_TITLE_OPTIONS,
  TITLE_KORTSELGER,
  TITLE_PALITELIG_SELGER,
  TITLE_SLAB_SPESIALIST,
  TITLE_SEALED_SAMLER,
  TITLE_TOPPRATET,
} from "@/lib/profile-titles";
import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";
import {
  computeTitleUnlocks,
  updateProfile,
} from "../profile/actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
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
    .select("display_name, username, shop_name, active_title")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Could not load profile: ${profileError.message}`);
  }

  const defaultDisplayName = profile?.display_name?.trim() ?? "";
  const defaultUsername = profile?.username?.trim() ?? "";
  const defaultShopName = profile?.shop_name?.trim() ?? "";
  const defaultActiveTitle = profile?.active_title?.trim() || "Kortselger";
  const unlockedTitles = await computeTitleUnlocks(supabase, user.id);
  const selectedTitle = unlockedTitles[defaultActiveTitle]
    ? defaultActiveTitle
    : TITLE_KORTSELGER;
  const titleRequirementText: Record<string, string> = {
    [TITLE_KORTSELGER]: "Alltid tilgjengelig",
    [TITLE_PALITELIG_SELGER]: "Lås opp med minst 5 fullførte salg",
    [TITLE_SLAB_SPESIALIST]: "Lås opp med minst 3 slab-annonser",
    [TITLE_SEALED_SAMLER]: "Lås opp med minst 3 sealed-annonser",
    [TITLE_TOPPRATET]: "Lås opp med rating 5.0 og minst 5 vurderinger",
  };
  const inputClass =
    "rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";
  const buttonClass =
    "rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";
  async function submitSettingsForm(formData: FormData): Promise<void> {
    "use server";
    await updateProfile(null, formData);
  }

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <div className="space-y-2">
          <p className="text-sm">
            <Link
              href="/profile"
              className="font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
            >
              ← Til Pokeshop
            </Link>
          </p>
          <h1 className={pageTitleClass}>Innstillinger</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Oppdater kontoinfoen din.
          </p>
        </div>
        <SignedInNavLinks />
      </header>

      <section className={pageBodyGapClass}>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Profilinnstillinger
        </h2>
        <form action={submitSettingsForm} className="mt-10 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              Display name
            </span>
            <input
              type="text"
              name="display_name"
              autoComplete="name"
              defaultValue={defaultDisplayName}
              className={inputClass}
              placeholder="How you want to appear"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              Username
            </span>
            <input
              type="text"
              name="username"
              autoComplete="username"
              defaultValue={defaultUsername}
              className={inputClass}
              placeholder="Public profile URL (optional)"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              Butikknavn
            </span>
            <input
              type="text"
              name="shop_name"
              defaultValue={defaultShopName}
              className={inputClass}
              placeholder="F.eks. Mikkels Pokeshop"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              Tittel
            </span>
            <select
              name="active_title"
              defaultValue={selectedTitle}
              className={inputClass}
            >
              {PROFILE_TITLE_OPTIONS.map(
                (title) => (
                  <option
                    key={title}
                    value={title}
                    disabled={!unlockedTitles[title]}
                  >
                    {title}
                    {!unlockedTitles[title] ? " (låst)" : ""}
                  </option>
                ),
              )}
            </select>
          </label>
          <ul className="text-xs text-zinc-600 dark:text-zinc-400">
            {PROFILE_TITLE_OPTIONS.map(
              (title) => (
                <li key={title}>
                  {title}: {unlockedTitles[title] ? "Opplåst" : titleRequirementText[title]}
                </li>
              ),
            )}
          </ul>

          <button type="submit" className={buttonClass}>
            Save
          </button>
        </form>
      </section>
    </div>
  );
}
