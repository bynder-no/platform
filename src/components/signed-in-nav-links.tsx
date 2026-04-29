import Link from "next/link";

import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

const navLinkClass =
  "text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300";

type SignedInNavLinksProps = {
  className?: string;
};

export async function SignedInNavLinks({ className }: SignedInNavLinksProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let unreadNotificationCount = 0;
  if (user) {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) {
      console.error("notifications unread count:", error.message);
    } else {
      unreadNotificationCount = count ?? 0;
    }
  }

  const varslerLabel =
    user && unreadNotificationCount > 0
      ? `Varsler (${unreadNotificationCount})`
      : "Varsler";

  return (
    <nav
      aria-label="Account"
      className={["flex flex-wrap items-center gap-x-3 gap-y-1 text-sm", className]
        .filter(Boolean)
        .join(" ")}
    >
      <Link href="/" className={navLinkClass}>
        Home
      </Link>
      <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
        ·
      </span>
      <Link href="/dashboard" className={navLinkClass}>
        Dashboard
      </Link>
      <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
        ·
      </span>
      <Link href="/my-listings" className={navLinkClass}>
        Mine aktive annonser
      </Link>
      <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
        ·
      </span>
      <Link href="/my-auctions" className={navLinkClass}>
        Mine deals
      </Link>
      <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
        ·
      </span>
      <Link href="/favorites" className={navLinkClass}>
        Favorites
      </Link>
      <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
        ·
      </span>
      <Link href="/following" className={navLinkClass}>
        Følger
      </Link>
      <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
        ·
      </span>
      <Link href="/messages" className={navLinkClass}>
        Messages
      </Link>
      <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
        ·
      </span>
      <Link href="/notifications" className={navLinkClass}>
        {varslerLabel}
      </Link>
      <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
        ·
      </span>
      <Link href="/profile" className={navLinkClass}>
        Profile
      </Link>
      <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
        ·
      </span>
      <form action={signOut} className="inline">
        <button
          type="submit"
          className={`${navLinkClass} cursor-pointer border-0 bg-transparent p-0`}
        >
          Logout
        </button>
      </form>
    </nav>
  );
}
