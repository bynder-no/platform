import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className={pageShellClass}>
        <header className={pageHeaderClass}>
          <h1 className={pageTitleClass}>Varsler</h1>
        </header>

        <section className={pageBodyGapClass}>
          <p className="text-sm text-zinc-600">
            Varsler åpnes fra menyen (bjelleikonet øverst).
          </p>
        </section>
      </div>
    </div>
  );
}
