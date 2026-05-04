export type DealStatusGroup =
  | "deal_venter"
  | "deal_bekreftet"
  | "no_deal"
  | "deal_fullfort";

export function dealStatusGroupLabel(group: DealStatusGroup): string {
  if (group === "deal_venter") return "Deal venter";
  if (group === "deal_bekreftet") return "Deal bekreftet";
  if (group === "deal_fullfort") return "Deal fullført";
  return "No deal";
}

type ResolveDealStatusGroupInput = {
  sellerDecision: string;
  bidderDecision: string;
  buyerReceivedCard: boolean;
  sellerReceivedPayment: boolean;
  isCompleted: boolean;
};

export function resolveDealStatusGroup({
  sellerDecision,
  bidderDecision,
  buyerReceivedCard,
  sellerReceivedPayment,
  isCompleted,
}: ResolveDealStatusGroupInput): DealStatusGroup {
  if (sellerDecision === "no_deal" || bidderDecision === "no_deal") {
    return "no_deal";
  }
  if (sellerDecision === "deal" && bidderDecision === "deal") {
    if (isCompleted || (buyerReceivedCard && sellerReceivedPayment)) {
      return "deal_fullfort";
    }
    return "deal_bekreftet";
  }
  return "deal_venter";
}

export function dealCounterpartDisplayName(
  username: string | null | undefined,
): string {
  const t = String(username ?? "").trim();
  return t !== "" ? t : "bruker";
}

export function dealStatusWaitOnCounterpart(
  username: string | null | undefined,
): string {
  return `Du venter på ${dealCounterpartDisplayName(username)}`;
}

export function dealStatusRespondToCounterpart(
  username: string | null | undefined,
): string {
  return `Du må svare til ${dealCounterpartDisplayName(username)}`;
}

type DealStatusDetailInput = {
  group: DealStatusGroup;
  viewerRole: "seller" | "buyer";
  isFixedPrice: boolean;
  sellerDecision: string;
  bidderDecision: string;
  buyerReceivedCard: boolean;
  sellerReceivedPayment: boolean;
  /** Brukernavn for den andre parten (selger ser kjøper, kjøper ser selger). */
  counterpartUsername?: string | null;
};

export function dealStatusDetailText({
  group,
  viewerRole,
  isFixedPrice,
  sellerDecision,
  bidderDecision,
  buyerReceivedCard,
  sellerReceivedPayment,
  counterpartUsername,
}: DealStatusDetailInput): string {
  if (group === "no_deal") {
    return "Handelen ble ikke noe av";
  }
  if (group === "deal_fullfort") {
    return "Handelen er fullført";
  }
  if (group === "deal_bekreftet") {
    if (!buyerReceivedCard) {
      return viewerRole === "buyer"
        ? "Bekreft når du har mottatt kortet"
        : "Venter på at kjøper mottar kortet";
    }
    if (!sellerReceivedPayment) {
      return viewerRole === "seller"
        ? "Bekreft når du har mottatt betaling"
        : "Venter på at selger bekrefter betaling";
    }
    return "Handelen er fullført";
  }

  if (isFixedPrice) {
    if (bidderDecision === "deal" && sellerDecision === "pending") {
      return viewerRole === "buyer"
        ? "Venter på svar fra selger"
        : "Kjøper venter på ditt svar";
    }
    if (sellerDecision === "deal" && bidderDecision === "pending") {
      return viewerRole === "buyer"
        ? "Selger venter på ditt svar"
        : "Venter på svar fra kjøper";
    }
    return viewerRole === "buyer"
      ? "Venter på svar fra selger"
      : "Venter på svar fra kjøper";
  }

  if (viewerRole === "seller") {
    return sellerDecision === "pending"
      ? "Handling kreves av deg"
      : dealStatusWaitOnCounterpart(counterpartUsername);
  }
  return bidderDecision === "pending"
    ? "Handling kreves av deg"
    : dealStatusWaitOnCounterpart(counterpartUsername);
}

/** Pill styling for mine-deals cards and deal room (rounded-full, px-3 py-1, text-sm). */
export const mineDealStatusBadgeBaseClass =
  "inline-flex w-fit rounded-full px-3 py-1 text-sm font-medium";

export type MineDealStatusTone = "action" | "wait" | "neutral";

export function mineDealStatusBadgeToneClass(tone: MineDealStatusTone): string {
  if (tone === "action") {
    return `${mineDealStatusBadgeBaseClass} bg-red-100 text-red-700`;
  }
  if (tone === "wait") {
    return `${mineDealStatusBadgeBaseClass} bg-green-100 text-green-700`;
  }
  return `${mineDealStatusBadgeBaseClass} bg-zinc-100 text-zinc-600`;
}

function resolveDealRoomTone(args: {
  group: DealStatusGroup;
  viewerRole: "seller" | "buyer";
  isFixedPrice: boolean;
  sellerDecision: string;
  bidderDecision: string;
  buyerReceivedCard: boolean;
  sellerReceivedPayment: boolean;
}): MineDealStatusTone {
  const {
    group,
    viewerRole,
    isFixedPrice,
    sellerDecision,
    bidderDecision,
    buyerReceivedCard,
    sellerReceivedPayment,
  } = args;

  if (group === "no_deal" || group === "deal_fullfort") {
    return "neutral";
  }

  if (group === "deal_bekreftet") {
    if (!buyerReceivedCard) {
      return viewerRole === "buyer" ? "action" : "wait";
    }
    if (!sellerReceivedPayment) {
      return viewerRole === "seller" ? "action" : "wait";
    }
    return "neutral";
  }

  // deal_venter
  if (isFixedPrice) {
    if (viewerRole === "seller" && sellerDecision === "pending") {
      return "action";
    }
    if (viewerRole === "buyer" && bidderDecision === "pending") {
      return "action";
    }
    return "wait";
  }

  if (viewerRole === "seller") {
    return sellerDecision === "pending" ? "action" : "wait";
  }
  return bidderDecision === "pending" ? "action" : "wait";
}

/**
 * Single primary status line + colors for deal room (matches card semantics).
 * Text is the same source as `dealStatusDetailText` for consistency.
 */
export function dealRoomStatusBadge(args: {
  group: DealStatusGroup;
  viewerRole: "seller" | "buyer";
  isFixedPrice: boolean;
  sellerDecision: string;
  bidderDecision: string;
  buyerReceivedCard: boolean;
  sellerReceivedPayment: boolean;
  counterpartUsername: string | null | undefined;
}): { text: string; className: string } {
  const text = dealStatusDetailText({
    group: args.group,
    viewerRole: args.viewerRole,
    isFixedPrice: args.isFixedPrice,
    sellerDecision: args.sellerDecision,
    bidderDecision: args.bidderDecision,
    buyerReceivedCard: args.buyerReceivedCard,
    sellerReceivedPayment: args.sellerReceivedPayment,
    counterpartUsername: args.counterpartUsername,
  });
  const tone = resolveDealRoomTone({
    group: args.group,
    viewerRole: args.viewerRole,
    isFixedPrice: args.isFixedPrice,
    sellerDecision: args.sellerDecision,
    bidderDecision: args.bidderDecision,
    buyerReceivedCard: args.buyerReceivedCard,
    sellerReceivedPayment: args.sellerReceivedPayment,
  });
  return { text, className: mineDealStatusBadgeToneClass(tone) };
}

/**
 * Auction listing cards (Mine salg / Mine kjøp — auksjon).
 * One badge per card; same conditions as overview hints, no DB/query changes.
 */
export function mineDealAuctionCardBadge(args: {
  viewerRole: "seller" | "bidder";
  group: DealStatusGroup;
  deal: {
    seller_decision: string;
    bidder_decision: string;
    buyer_received_card: boolean;
    seller_received_payment: boolean;
  } | null | undefined;
  counterpartUsername: string | null | undefined;
}): { text: string; className: string } {
  const { viewerRole, group, deal, counterpartUsername } = args;

  if (group === "no_deal" || group === "deal_fullfort") {
    return {
      text: dealStatusGroupLabel(group),
      className: mineDealStatusBadgeToneClass("neutral"),
    };
  }

  if (group === "deal_venter") {
    const s = String(deal?.seller_decision ?? "pending");
    const b = String(deal?.bidder_decision ?? "pending");
    const mine = viewerRole === "seller" ? s : b;
    const vr = viewerRole === "bidder" ? "buyer" : "seller";
    const text = dealStatusDetailText({
      group: "deal_venter",
      viewerRole: vr,
      isFixedPrice: false,
      sellerDecision: s,
      bidderDecision: b,
      buyerReceivedCard: deal?.buyer_received_card ?? false,
      sellerReceivedPayment: deal?.seller_received_payment ?? false,
      counterpartUsername,
    });
    const tone: MineDealStatusTone = mine === "pending" ? "action" : "wait";
    return { text, className: mineDealStatusBadgeToneClass(tone) };
  }

  // deal_bekreftet
  if (!deal) {
    return {
      text: dealStatusGroupLabel("deal_bekreftet"),
      className: mineDealStatusBadgeToneClass("neutral"),
    };
  }
  {
    const vr = viewerRole === "bidder" ? "buyer" : "seller";
    const text = dealStatusDetailText({
      group: "deal_bekreftet",
      viewerRole: vr,
      isFixedPrice: false,
      sellerDecision: deal.seller_decision,
      bidderDecision: deal.bidder_decision,
      buyerReceivedCard: deal.buyer_received_card,
      sellerReceivedPayment: deal.seller_received_payment,
      counterpartUsername,
    });
    const tone: MineDealStatusTone =
      deal.seller_decision === "deal" && deal.bidder_decision === "deal"
        ? !deal.buyer_received_card
          ? viewerRole === "bidder"
            ? "action"
            : "wait"
          : !deal.seller_received_payment
            ? viewerRole === "seller"
              ? "action"
              : "wait"
            : "neutral"
        : "wait";
    return { text, className: mineDealStatusBadgeToneClass(tone) };
  }
}

/**
 * Fastpris listing cards (Mine salg / Mine kjøp — fastpris).
 */
export function mineDealFixedCardBadge(args: {
  viewerRole: "seller" | "buyer";
  group: DealStatusGroup;
  sellerDecision: string;
  bidderDecision: string;
  buyerReceivedCard: boolean;
  sellerReceivedPayment: boolean;
  counterpartUsername: string | null | undefined;
}): { text: string; className: string } {
  const {
    viewerRole,
    group,
    sellerDecision,
    bidderDecision,
    buyerReceivedCard,
    sellerReceivedPayment,
    counterpartUsername,
  } = args;

  if (group === "no_deal" || group === "deal_fullfort") {
    return {
      text: dealStatusGroupLabel(group),
      className: mineDealStatusBadgeToneClass("neutral"),
    };
  }

  if (group === "deal_venter") {
    const text = dealStatusDetailText({
      group: "deal_venter",
      viewerRole,
      isFixedPrice: true,
      sellerDecision,
      bidderDecision,
      buyerReceivedCard,
      sellerReceivedPayment,
      counterpartUsername,
    });
    const tone: MineDealStatusTone =
      (viewerRole === "seller" && sellerDecision === "pending") ||
      (viewerRole === "buyer" && bidderDecision === "pending")
        ? "action"
        : "wait";
    return { text, className: mineDealStatusBadgeToneClass(tone) };
  }

  // deal_bekreftet
  {
    const text = dealStatusDetailText({
      group: "deal_bekreftet",
      viewerRole,
      isFixedPrice: true,
      sellerDecision,
      bidderDecision,
      buyerReceivedCard,
      sellerReceivedPayment,
      counterpartUsername,
    });
    const tone: MineDealStatusTone =
      sellerDecision === "deal" && bidderDecision === "deal"
        ? !buyerReceivedCard
          ? viewerRole === "buyer"
            ? "action"
            : "wait"
          : !sellerReceivedPayment
            ? viewerRole === "seller"
              ? "action"
              : "wait"
            : "neutral"
        : "wait";
    return { text, className: mineDealStatusBadgeToneClass(tone) };
  }
}
