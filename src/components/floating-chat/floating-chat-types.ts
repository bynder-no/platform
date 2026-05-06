export type ChatPreview = {
  kind: "chat";
  id: string;
  otherName: string;
  preview: string;
  when: string;
  status: string;
  requesterId: string;
  recipientId: string;
  unreadCount: number;
  messages: Array<{
    id: string;
    senderId: string;
    body: string;
    createdAt: string | null;
  }>;
};

export type DealPreview = {
  kind: "deal";
  id: string;
  dealRowId: string;
  listingId: string;
  dealBidderId: string;
  sellerId: string;
  bidderId: string;
  sellerDecision: string;
  bidderDecision: string;
  otherName: string;
  listingTitle: string;
  listingImageUrl: string | null;
  listingUrl: string;
  dealRoomUrl: string;
  preview: string;
  when: string;
  statusBadge: string | null;
  statusTone: "neutral" | "action" | "wait";
  canRespond: boolean;
  responderRole: "seller" | "bidder" | null;
  viewerRole: "seller" | "buyer";
  unreadCount: number;
  messages: Array<{
    id: string;
    senderId: string;
    body: string;
    createdAt: string | null;
  }>;
};

export type InboxThread = ChatPreview | DealPreview;

export type ChatPatch = Partial<InboxThread> & {
  messages?: InboxThread["messages"];
};
