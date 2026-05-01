import Link from "next/link";
import { redirect } from "next/navigation";

import { NotificationRowLink } from "@/app/notifications/notification-row-link";
import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";
import { isNormalChatNotificationType } from "@/lib/normal-chat-badges";
import { fixedPriceOfferSellerDealHref } from "@/lib/notification-destinations";

export const dynamic = "force-dynamic";

type NotificationRow = {
  id: string;
  type: string;
  listing_id: string | null;
  thread_id: string | null;
  bidder_id: string | null;
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
  if (row.type === "fixed_price_offer" && row.listing_id) {
    return fixedPriceOfferSellerDealHref(row.listing_id, row.bidder_id);
  }
  const category = categoryForType(row.type);
  if (category === "Meldinger") return "/";
  if (category === "Deals" || category === "Rating") {
    if (row.listing_id) return `/my-auctions/${row.listing_id}`;
    return "/my-auctions";
  }
  if (row.listing_id) return `/listings/${row.listing_id}`;
  return "/notifications";
}

function destinationLabel(row: NotificationRow): string {
  if (row.type === "fixed_price_offer") {
    return row.listing_id ? "Gå til fastpris-deal" : "Gå til Mine deals";
  }
  const category = categoryForType(row.type);
  if (category === "Meldinger") return "Åpne meldinger";
  if (category === "Deals" || category === "Rating") {
    return row.listing_id ? "Gå til deal" : "Gå til Mine deals";
  }
  return "Se annonse";
}

function listingHrefForContext(row: NotificationRow): string | null {
  if (!row.listing_id) return null;
  if (row.type === "fixed_price_offer") {
    return fixedPriceOfferSellerDealHref(row.listing_id, row.bidder_id);
  }
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
    return "rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white";
  }
  return "rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100";
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
    .select("id, type, listing_id, thread_id, bidder_id, message, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Could not load notifications: ${error.message}`);
  }

  const notifications = ((data ?? []) as NotificationRow[]).filter(
    (row) => !isNormalChatNotificationType(row.type),
  );
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

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <h1 className={pageTitleClass}>Varsler</h1>
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
          <p className="text-sm text-zinc-600">Ingen varsler ennå.</p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
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
                  className="border-b border-zinc-200 last:border-b-0"
                >
                  <NotificationRowLink
                    notificationId={n.id}
                    href={destination}
                    isUnread={!n.is_read}
                    className={`flex items-start gap-3 px-3 py-3 hover:bg-zinc-50 ${
                      n.is_read ? "" : "bg-blue-50/60"
                    }`}
                  >
                    <div className="relative mt-0.5 h-11 w-11 shrink-0 rounded-full bg-zinc-200">
                      <span className="flex h-full w-full items-center justify-center text-base">
                        👤
                      </span>
                      <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-blue-600 text-[10px] text-white">
                        {icon}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-zinc-900">
                        {title}
                      </p>
                      <p className="mt-0.5 text-sm text-zinc-700">
                        {message}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">
                          {category}
                        </span>
                        {contextListingHref && listingLabel ? (
                          <span className="text-zinc-600">
                            {listingLabel}
                          </span>
                        ) : null}
                        <span className="text-zinc-500">
                          {formatWhen(n.created_at)}
                        </span>
                        <span className="font-medium text-zinc-700">
                          {destinationText}
                        </span>
                      </div>
                    </div>

                    {!n.is_read ? (
                      <span
                        className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600"
                        aria-label="Ulest"
                        title="Ulest"
                      />
                    ) : null}
                  </NotificationRowLink>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      </div>
    </div>
  );
}
