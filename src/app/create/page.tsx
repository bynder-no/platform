import { redirect } from "next/navigation";

import { SignedInNavLinks } from "@/components/signed-in-nav-links";
import { createClient } from "@/lib/supabase/server";
import {
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";

import { CreateListingForm } from "./create-listing-form";

export const dynamic = "force-dynamic";

export default async function CreateListingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <div className="space-y-2">
          <h1 className={pageTitleClass}>Create listing</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            New listings are saved as drafts. Price is stored in NOK.
          </p>
        </div>
        <SignedInNavLinks />
      </header>
      <CreateListingForm />
    </div>
  );
}
