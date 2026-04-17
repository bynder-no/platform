import Link from "next/link";

import { signOut } from "@/app/auth/actions";

const navLinkClass =
  "text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300";

type SignedInNavLinksProps = {
  className?: string;
};

export function SignedInNavLinks({ className }: SignedInNavLinksProps) {
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
      <Link href="/my-auctions" className={navLinkClass}>
        Mine auksjoner
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
      <Link href="/messages" className={navLinkClass}>
        Messages
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
