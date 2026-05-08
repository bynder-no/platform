export type NotificationRow = {
  id: string;
  type: string;
  listing_id: string | null;
  thread_id: string | null;
  resolved_thread_id?: string | null;
  bidder_id: string | null;
  is_read: boolean;
  message: string | null;
  created_at: string | null;
};

export type NotificationCategory =
  | "Bud"
  | "Deals"
  | "Meldinger"
  | "Rating"
  | "Auksjon"
  | "System";

export function isDealRelatedNotificationType(type: string): boolean {
  return (
    type === "fixed_price_offer" ||
    type === "deal_action_required" ||
    type === "deal_requires_action" ||
    type === "deal_relevant" ||
    type === "rating_available"
  );
}

export function categoryForType(type: string): NotificationCategory {
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

export function titleForType(type: string): string {
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

export function categoryIcon(category: NotificationCategory): string {
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

/** Deep link when user activates a notification (no /notifications fallback). */
export function destinationHref(row: NotificationRow): string {
  if (isDealRelatedNotificationType(row.type)) {
    const threadId = String(row.resolved_thread_id ?? row.thread_id ?? "").trim();
    if (threadId !== "") {
      const params = new URLSearchParams();
      params.set("chatThread", threadId);
      return `/?${params.toString()}`;
    }
    return "/";
  }
  const category = categoryForType(row.type);
  if (category === "Meldinger") return "/";
  if (row.listing_id) return `/listings/${row.listing_id}`;
  return "/";
}

export function destinationLabel(row: NotificationRow): string {
  if (isDealRelatedNotificationType(row.type)) return "Åpne i Meldinger/Deals";
  const category = categoryForType(row.type);
  if (category === "Meldinger") return "Åpne meldinger";
  return "Se annonse";
}

export function listingHrefForContext(row: NotificationRow): string | null {
  if (!row.listing_id) return null;
  if (isDealRelatedNotificationType(row.type)) return `/listings/${row.listing_id}`;
  return `/listings/${row.listing_id}`;
}

export function formatNotificationWhen(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("nb-NO");
}
