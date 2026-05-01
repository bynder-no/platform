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
  thread_id: string | null;
  is_read: boolean;
  message: string | null;
  created_at: string | null;
};

type NotificationCategory =
  | "Bud"
  | "Deals"
  | "Meldinger"
  | "Rating"
  | "Auksjon"
  | "System";
type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

function categoryForType(type: string): NotificationCategory {
  if (
    type === "outbid" ||
    type === "seller_bid_received" ||
    type === "fixed_price_offer"
  ) {
    return "Bud";
  }
  if (
    type === "deal_action_required" ||
    type === "deal_requires_action" ||
    type === "deal_relevant"
  ) {
    return "Deals";
  }
  if (type === "message_request" || type === "new_message") return "Meldinger";
  if (type === "rating_available") return "Rating";
  if (
    type === "won_auction" ||
    type === "auction_no_result" ||
    type === "no_successful_result"
  ) {
    return "Auksjon";
  }
  return "System";
}

function titleForType(type: string): string {
  switch (type) {
    case "outbid":
      return "Du har blitt overbydd";
    case "seller_bid_received":
      return "Nytt bud mottatt";
    case "fixed_price_offer":
      return "Nytt fastprisbud";
    case "deal_action_required":
      return "Handling kreves i deal";
    case "deal_requires_action":
      return "Deal krever handling";
    case "deal_relevant":
      return "Oppdatering i deal";
    case "won_auction":
      return "Du vant auksjonen";
    case "auction_no_result":
      return "Auksjon uten resultat";
    case "no_successful_result":
      return "Ingen vellykket handel";
    case "rating_available":
      return "Ny rating tilgjengelig";
    case "message_request":
      return "Ny meldingsforespørsel";
    case "new_message":
      return "Ny melding";
    default:
      return "Systemvarsel";
  }
}

function categoryIcon(category: NotificationCategory): string {
  switch (category) {
    case "Bud":
      return "💰";
    case "Deals":
      return "🤝";
    case "Meldinger":
      return "💬";
    case "Rating":
      return "⭐";
    case "Auksjon":
      return "🔨";
    default:
      return "🔔";
  }
}

function destinationHref(row: NotificationRow): string {
  const category = categoryForType(row.type);
  if (category === "Meldinger") return "/messages";
  if (category === "Deals" || category === "Rating") {
    if (row.listing_id) return `/my-auctions/${row.listing_id}`;
    return "/my-auctions";
  }
  if (row.listing_id) return `/listings/${row.listing_id}`;
  return "/notifications";
}

function destinationLabel(row: NotificationRow): string {
  const category = categoryForType(row.type);
  if (category === "Meldinger") return "Åpne meldinger";
  if (category === "Deals" || category === "Rating") {
    return row.listing_id ? "Gå til deal" : "Gå til Mine deals";
  }
  return "Se annonse";
}

function listingHrefForContext(row: NotificationRow): string | null {
  if (!row.listing_id) return null;
  const category = categoryForType(row.type);
  if (category === "Deals" || category === "Rating") {
    return `/my-auctions/${row.listing_id}`;
  }
  if (
    row.type === "deal_action_required" ||
    row.type === "deal_requires_action" ||
    row.type === "deal_relevant"
  ) {
    return `/my-auctions/${row.listing_id}`;
  }
  return `/listings/${row.listing_id}`;
}

function formatWhen(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("nb-NO");
}

function tabClass(active: boolean) {
  if (active) {
    return "rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900";
  }
  return "rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700";
}

export default async function NotificationsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const tab = sp.tab === "unread" ? "unread" : "all";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, listing_id, thread_id, message, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Could not load notifications: ${error.message}`);
  }

  const notifications = (data ?? []) as NotificationRow[];
  const visibleNotifications =
    tab === "unread"
      ? notifications.filter((notification) => !notification.is_read)
      : notifications;
  const listingIds = [
    ...new Set(
      visibleNotifications
        .map((notification) => notification.listing_id)
        .filter((id): id is string => !!id),
    ),
  ];

  const listingTitleById = new Map<string, string>();
  if (listingIds.length > 0) {
    const { data: listingRows, error: listingError } = await supabase
      .from("listings")
      .select("id, title")
      .in("id", listingIds);
    if (listingError) {
      throw new Error(`Could not load listing labels: ${listingError.message}`);
    }
    for (const listing of listingRows ?? []) {
      const title = String(listing.title ?? "").trim() || "Annonse";
      listingTitleById.set(String(listing.id), title);
    }
  }

  const { error: markReadError } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);
  if (markReadError) {
    throw new Error(`Could not mark notifications as read: ${markReadError.message}`);
  }

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <h1 className={pageTitleClass}>Varsler</h1>
        <SignedInNavLinks />
      </header>

      <section className={pageBodyGapClass}>
        <div className="flex items-center gap-2">
          <Link href="/notifications" className={tabClass(tab === "all")}>
            Alle ({notifications.length})
          </Link>
          <Link
            href="/notifications?tab=unread"
            className={tabClass(tab === "unread")}
          >
            Uleste ({notifications.filter((n) => !n.is_read).length})
          </Link>
        </div>

        {visibleNotifications.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Ingen varsler ennå.</p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            {visibleNotifications.map((n) => {
              const category = categoryForType(n.type);
              const title = titleForType(n.type);
              const message = String(n.message ?? "").trim() || "Varsel";
              const destination = destinationHref(n);
              const destinationText = destinationLabel(n);
              const icon = categoryIcon(category);
              const contextListingHref = listingHrefForContext(n);
              const listingLabel = n.listing_id
                ? listingTitleById.get(n.listing_id) ?? "Annonse"
                : null;
              return (
                <li
                  key={n.id}
                  className="border-b border-zinc-200 last:border-b-0 dark:border-zinc-700"
                >
                  <Link
                    href={destination}
                    className={`flex items-start gap-3 px-3 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${
                      n.is_read ? "" : "bg-blue-50/60 dark:bg-blue-950/20"
                    }`}
                  >
                    <div className="relative mt-0.5 h-11 w-11 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700">
                      <span className="flex h-full w-full items-center justify-center text-base">
                        👤
                      </span>
                      <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-zinc-900 text-[10px] text-white dark:border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900">
                        {icon}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {title}
                      </p>
                      <p className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">
                        {message}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {category}
                        </span>
                        {contextListingHref && listingLabel ? (
                          <span className="text-zinc-600 dark:text-zinc-300">
                            {listingLabel}
                          </span>
                        ) : null}
                        <span className="text-zinc-500 dark:text-zinc-400">
                          {formatWhen(n.created_at)}
                        </span>
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {destinationText}
                        </span>
                      </div>
                    </div>

                    {!n.is_read ? (
                      <span
                        className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500"
                        aria-label="Ulest"
                        title="Ulest"
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
