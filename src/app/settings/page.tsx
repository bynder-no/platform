import Link from "next/link";
import { redirect } from "next/navigation";

import { SignedInNavLinks } from "@/components/signed-in-nav-links";
import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";

import { ProfileEditForm } from "../profile/profile-edit-form";

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
    .select("display_name, username, shop_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Could not load profile: ${profileError.message}`);
  }

  const defaultDisplayName = profile?.display_name?.trim() ?? "";
  const defaultUsername = profile?.username?.trim() ?? "";
  const defaultShopName = profile?.shop_name?.trim() ?? "";

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
        <ProfileEditForm
          defaultDisplayName={defaultDisplayName}
          defaultUsername={defaultUsername}
          defaultShopName={defaultShopName}
        />
      </section>
    </div>
  );
}
