import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { SignedInNavLinksClient } from "@/components/signed-in-nav-links-client";
import { NOTIFICATIONS_NAV_HREF } from "@/lib/chat-panel-events";
import { getMessagesNavBadgeCount } from "@/lib/normal-chat-badges";
import { getVarslerUnreadCount } from "@/lib/notification-destinations";

type SignedInNavLinksProps = {
  className?: string;
};

type NavLinkItem = {
  href: string;
  label: string;
};

/** Grouped header: left | middle | account + logout */
const NAV_GROUP_LEFT: NavLinkItem[] = [
  { href: "/", label: "Home" },
  { href: "/following", label: "Følger" },
  { href: "/discover", label: "Discover" },
];

const NAV_GROUP_MIDDLE: NavLinkItem[] = [
  { href: "/dashboard", label: "Dashboard" },
];

const NAV_GROUP_RIGHT: NavLinkItem[] = [
  { href: NOTIFICATIONS_NAV_HREF, label: "Varsler" },
  { href: "#chatter", label: "Messages" },
  { href: "/profile", label: "Profile" },
];

export async function SignedInNavLinks({ className }: SignedInNavLinksProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const varslerBadgeCount = await getVarslerUnreadCount(supabase, user.id);

  const messagesBadgeCount = await getMessagesNavBadgeCount(supabase, user.id);

  const groups: NavLinkItem[][] = [
    NAV_GROUP_LEFT,
    NAV_GROUP_MIDDLE,
    NAV_GROUP_RIGHT,
  ];

  return (
    <div className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 py-2 backdrop-blur">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <nav
          aria-label="Account"
          className={[
            "flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl border border-zinc-200 bg-white p-2 text-sm shadow-sm",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <SignedInNavLinksClient
            groups={groups}
            messagesBadgeCount={messagesBadgeCount}
            varslerBadgeCount={varslerBadgeCount}
          >
            <form action={signOut} className="inline">
              <button
                type="submit"
                className="ui-nav-chip cursor-pointer text-zinc-500 hover:border-red-300 hover:bg-red-50 hover:text-red-800"
              >
                Logout
              </button>
            </form>
          </SignedInNavLinksClient>
        </nav>
      </div>
    </div>
  );
}
