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
  return `Venter på ${dealCounterpartDisplayName(username)}`;
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
      ? "Handling kreves fra deg"
      : dealStatusWaitOnCounterpart(counterpartUsername);
  }
  return bidderDecision === "pending"
    ? "Handling kreves fra deg"
    : dealStatusWaitOnCounterpart(counterpartUsername);
}
