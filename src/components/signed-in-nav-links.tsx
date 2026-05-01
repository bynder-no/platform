import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { SignedInNavLinksClient } from "@/components/signed-in-nav-links-client";

type SignedInNavLinksProps = {
  className?: string;
};

type NavLinkItem = {
  href: string;
  label: string;
};

export async function SignedInNavLinks({ className }: SignedInNavLinksProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  let unreadNotificationCount = 0;
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

  const varslerLabel =
    unreadNotificationCount > 0 ? `Varsler (${unreadNotificationCount})` : "Varsler";

  const links: NavLinkItem[] = [
    { href: "/", label: "Home" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/following", label: "Følger" },
    { href: "/discover", label: "Discover" },
    { href: "/messages", label: "Messages" },
    { href: "/notifications", label: varslerLabel },
    { href: "/profile", label: "Profile" },
  ];

  return (
    <div className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 py-2 backdrop-blur">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <nav
          aria-label="Account"
          className={[
            "flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-2 text-sm shadow-sm",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <SignedInNavLinksClient links={links} />
          <form action={signOut} className="inline">
            <button
              type="submit"
              className="ui-nav-chip cursor-pointer text-zinc-500 hover:border-red-300 hover:bg-red-50 hover:text-red-800"
            >
              Logout
            </button>
          </form>
        </nav>
      </div>
    </div>
  );
}
