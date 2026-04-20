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

export const dynamic = "force-dynamic";

type NotificationRow = {
  id: string;
  type: string;
  listing_id: string | null;
  message: string | null;
  created_at: string | null;
};

function notificationHref(row: NotificationRow): string | null {
  if (!row.listing_id) return null;
  if (row.type === "deal_action_required") {
    return `/my-auctions/${row.listing_id}`;
  }
  return `/listings/${row.listing_id}`;
}

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, listing_id, message, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Could not load notifications: ${error.message}`);
  }

  const notifications = (data ?? []) as NotificationRow[];

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <h1 className={pageTitleClass}>Varsler</h1>
        <SignedInNavLinks />
      </header>

      <section className={pageBodyGapClass}>
        {notifications.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Ingen varsler ennå.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
            {notifications.map((n) => {
              const href = notificationHref(n);
              const message = String(n.message ?? "").trim() || "Varsel";
              const when = n.created_at
                ? new Date(n.created_at).toLocaleString()
                : "—";
              return (
                <li key={n.id} className="px-3 py-3 text-sm">
                  {href ? (
                    <Link
                      href={href}
                      className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                    >
                      {message}
                    </Link>
                  ) : (
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {message}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{when}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
