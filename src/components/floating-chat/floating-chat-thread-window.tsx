"use client";

import type { RefObject } from "react";

import {
  acceptConversationRequest,
  declineConversationRequest,
} from "@/app/messages/actions";
import { setListingDealDecision } from "@/app/listings/[id]/actions";
import {
  markBuyerReceivedCard,
  markSellerReceivedPayment,
} from "@/app/my-auctions/[id]/actions";

import {
  indexOfLatestOwnMessage,
  OutgoingDeliveryLabel,
} from "@/components/chat-outgoing-delivery-label";

import { formatMessageBubbleTime } from "@/lib/chatter-list-time";

import type { ChatPreview, InboxThread } from "./floating-chat-types";

type FloatingChatThreadWindowProps = {
  thread: InboxThread;
  currentUserId: string;
  minimized: boolean;
  onMinimize: () => void;
  onClose: () => void;
  onRestoreFromMinimized: () => void;
  composerValue: string;
  onComposerChange: (value: string) => void;
  sendPending: boolean;
  sendError: string | null;
  threadMessagesScrollRef: RefObject<HTMLDivElement | null> | null;
  threadMessagesEndRef: RefObject<HTMLDivElement | null> | null;
  onAfterDecline: () => void;
  onThreadPatch: (threadId: string, patch: Partial<ChatPreview>) => void;
  onHideThread: (threadId: string) => void;
  routerRefresh: () => void;
  onSubmitSend: (formData: FormData) => Promise<void>;
};

export function FloatingChatThreadWindow({
  thread,
  currentUserId,
  minimized,
  onMinimize,
  onClose,
  onRestoreFromMinimized,
  composerValue,
  onComposerChange,
  sendPending,
  sendError,
  threadMessagesScrollRef,
  threadMessagesEndRef,
  onAfterDecline,
  onThreadPatch,
  onHideThread,
  routerRefresh,
  onSubmitSend,
}: FloatingChatThreadWindowProps) {
  const uid = String(currentUserId);
  const selectedThread = thread;
  const isDealThread = selectedThread.kind === "deal";
  const responderRole = isDealThread ? selectedThread.responderRole : null;
  const canRenderDealActions =
    isDealThread &&
    Boolean(selectedThread.listingId) &&
    responderRole !== null;

  const canSend =
    isDealThread
      ? true
      : String(selectedThread.status) === "accepted" ||
        (String(selectedThread.status) === "pending" &&
          String(selectedThread.requesterId) === uid);
  const isRecipient =
    !isDealThread &&
    String(selectedThread.status) === "pending" &&
    String(selectedThread.recipientId) === uid;
  const isRequesterWaiting =
    !isDealThread &&
    String(selectedThread.status) === "pending" &&
    String(selectedThread.requesterId) === uid;
  const canShowDealActions = canRenderDealActions && selectedThread.canRespond;
  const dealAcceptedByBoth =
    isDealThread &&
    selectedThread.sellerDecision === "deal" &&
    selectedThread.bidderDecision === "deal";
  const buyerReceivedCardConfirmed =
    isDealThread && selectedThread.buyerReceivedCard === true;
  const sellerReceivedPaymentConfirmed =
    isDealThread && selectedThread.sellerReceivedPayment === true;
  const dealCompleted =
    isDealThread && buyerReceivedCardConfirmed && sellerReceivedPaymentConfirmed;
  const isDealBuyer = isDealThread && selectedThread.viewerRole === "buyer";
  const isDealSeller = isDealThread && selectedThread.viewerRole === "seller";

  if (minimized) {
    return (
      <button
        type="button"
        onClick={onRestoreFromMinimized}
        className="pointer-events-auto max-w-[220px] truncate rounded-full border border-zinc-200/90 bg-white px-4 py-2.5 text-left text-sm font-medium text-zinc-900 shadow-lg shadow-zinc-900/10 transition hover:bg-zinc-50"
        aria-label={`Gjenopprett samtale med ${selectedThread.otherName}`}
      >
        {selectedThread.otherName}
      </button>
    );
  }

  return (
    <div className="pointer-events-auto w-[min(100vw-2rem,360px)] overflow-hidden rounded-t-2xl rounded-b-xl border border-zinc-200/90 bg-white shadow-2xl shadow-zinc-900/15">
      <div className="flex h-[min(72vh,480px)] flex-col">
        <div className="flex shrink-0 items-center gap-1 border-b border-zinc-200 bg-zinc-100/90 px-2 py-2">
          <p className="min-w-0 flex-1 truncate px-1 text-sm font-semibold text-zinc-900">
            {isDealThread ? selectedThread.listingTitle : selectedThread.otherName}
          </p>
          <button
            type="button"
            onClick={onMinimize}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-zinc-200/80"
            aria-label="Minimer samtale"
          >
            <span className="text-lg leading-none" aria-hidden>
              −
            </span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-zinc-200/80"
            aria-label="Lukk samtale"
          >
            <span className="text-base leading-none" aria-hidden>
              ×
            </span>
          </button>
        </div>
        <div className="shrink-0 border-b border-zinc-100 bg-white px-3 py-2">
          {isDealThread ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
                  {selectedThread.listingImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedThread.listingImageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-1 text-xs font-medium text-zinc-900">
                    {selectedThread.listingTitle}
                  </p>
                  <p className="text-[11px] text-zinc-600">
                    Snakker med {selectedThread.otherName}
                  </p>
                  <a
                    href={selectedThread.listingUrl}
                    className="text-[11px] font-medium text-blue-600 hover:underline"
                  >
                    Se annonse
                  </a>
                </div>
              </div>
              {canShowDealActions ? (
                <div className="flex items-center gap-2">
                  <form
                    action={async (formData) => {
                      await setListingDealDecision(null, formData);
                      routerRefresh();
                    }}
                  >
                    <input type="hidden" name="listing_id" value={selectedThread.listingId} />
                    <input type="hidden" name="role" value={responderRole} />
                    <input type="hidden" name="decision" value="deal" />
                    <input type="hidden" name="inbox_context" value="1" />
                    {selectedThread.dealBidderId !== "" ? (
                      <input
                        type="hidden"
                        name="deal_bidder_id"
                        value={selectedThread.dealBidderId}
                      />
                    ) : null}
                    <button
                      type="submit"
                      className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Deal
                    </button>
                  </form>
                  <form
                    action={async (formData) => {
                      await setListingDealDecision(null, formData);
                      routerRefresh();
                    }}
                  >
                    <input type="hidden" name="listing_id" value={selectedThread.listingId} />
                    <input type="hidden" name="role" value={responderRole} />
                    <input type="hidden" name="decision" value="no_deal" />
                    <input type="hidden" name="inbox_context" value="1" />
                    {selectedThread.dealBidderId !== "" ? (
                      <input
                        type="hidden"
                        name="deal_bidder_id"
                        value={selectedThread.dealBidderId}
                      />
                    ) : null}
                    <button
                      type="submit"
                      className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                    >
                      No deal
                    </button>
                  </form>
                </div>
              ) : (
                <p className="text-[11px] text-zinc-500">
                  Ingen tilgjengelige deal-handlinger nå
                </p>
              )}
              {dealAcceptedByBoth ? (
                <div className="flex flex-wrap items-center gap-2">
                  {isDealBuyer ? (
                    buyerReceivedCardConfirmed ? (
                      <p className="text-[11px] text-zinc-500">
                        Kort mottatt bekreftet
                      </p>
                    ) : (
                      <form
                        action={async (formData) => {
                          await markBuyerReceivedCard(null, formData);
                          routerRefresh();
                        }}
                      >
                        <input
                          type="hidden"
                          name="listing_id"
                          value={selectedThread.listingId}
                        />
                        <input type="hidden" name="inbox_context" value="1" />
                        {selectedThread.dealBidderId !== "" ? (
                          <input
                            type="hidden"
                            name="deal_bidder_id"
                            value={selectedThread.dealBidderId}
                          />
                        ) : null}
                        <button
                          type="submit"
                          className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-900 hover:bg-zinc-100"
                        >
                          Kort mottatt
                        </button>
                      </form>
                    )
                  ) : null}
                  {isDealSeller ? (
                    sellerReceivedPaymentConfirmed ? (
                      <p className="text-[11px] text-zinc-500">
                        Betaling mottatt bekreftet
                      </p>
                    ) : (
                      <form
                        action={async (formData) => {
                          await markSellerReceivedPayment(null, formData);
                          routerRefresh();
                        }}
                      >
                        <input
                          type="hidden"
                          name="listing_id"
                          value={selectedThread.listingId}
                        />
                        <input type="hidden" name="inbox_context" value="1" />
                        {selectedThread.dealBidderId !== "" ? (
                          <input
                            type="hidden"
                            name="deal_bidder_id"
                            value={selectedThread.dealBidderId}
                          />
                        ) : null}
                        <button
                          type="submit"
                          className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-900 hover:bg-zinc-100"
                        >
                          Betaling mottatt
                        </button>
                      </form>
                    )
                  ) : null}
                  {dealCompleted ? (
                    <p className="text-[11px] font-medium text-emerald-700">
                      Deal fullført
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : isRecipient ? (
            <div className="flex items-center gap-2">
              <form
                action={async (formData) => {
                  await acceptConversationRequest(formData);
                  const tid = String(formData.get("thread_id") ?? "");
                  onThreadPatch(tid, { status: "accepted", unreadCount: 0 });
                  routerRefresh();
                }}
              >
                <input type="hidden" name="thread_id" value={selectedThread.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
                >
                  Godta
                </button>
              </form>
              <form
                action={async (formData) => {
                  await declineConversationRequest(formData);
                  const tid = String(formData.get("thread_id") ?? "");
                  onHideThread(tid);
                  onAfterDecline();
                  routerRefresh();
                }}
              >
                <input type="hidden" name="thread_id" value={selectedThread.id} />
                <button
                  type="submit"
                  className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700"
                >
                  Avslå
                </button>
              </form>
            </div>
          ) : isRequesterWaiting ? (
            <p className="text-xs text-zinc-600">Venter på godkjenning.</p>
          ) : null}
        </div>
        <div
          ref={threadMessagesScrollRef ?? undefined}
          className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-zinc-50/40 px-3 py-3"
        >
          {selectedThread.messages.length === 0 ? (
            <p className="text-xs text-zinc-600">Ingen meldinger ennå.</p>
          ) : (
            (() => {
              const latestOwnIdx = indexOfLatestOwnMessage(
                selectedThread.messages,
                uid,
              );
              return selectedThread.messages.map((message, index) => {
                const isOwn = String(message.senderId) === uid;
                const showDelivery =
                  isOwn &&
                  latestOwnIdx >= 0 &&
                  index === latestOwnIdx;
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`flex max-w-[85%] flex-col ${isOwn ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`rounded-2xl px-3 py-1.5 text-xs ${
                          isOwn
                            ? "bg-blue-600 text-white shadow-sm"
                            : "border border-zinc-200/80 bg-white text-zinc-900 shadow-sm"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.body}</p>
                        <p className="mt-1 text-xs text-zinc-400">
                          {formatMessageBubbleTime(message.createdAt)}
                        </p>
                      </div>
                      {showDelivery ? (
                        <OutgoingDeliveryLabel
                          readAt={
                            isDealThread ? undefined : message.readAt
                          }
                        />
                      ) : null}
                    </div>
                  </div>
                );
              });
            })()
          )}
          <div
            ref={threadMessagesEndRef ?? undefined}
            className="h-0 w-full shrink-0"
            aria-hidden
          />
        </div>
        <form
          action={async (formData) => {
            await onSubmitSend(formData);
          }}
          className="shrink-0 border-t border-zinc-200 bg-white px-3 py-2"
        >
          <input type="hidden" name="thread_id" value={selectedThread.id} />
          {isDealThread ? (
            <>
              <input type="hidden" name="listing_id" value={selectedThread.listingId} />
              {selectedThread.dealBidderId !== "" ? (
                <input
                  type="hidden"
                  name="deal_bidder_id"
                  value={selectedThread.dealBidderId}
                />
              ) : null}
            </>
          ) : null}
          <div className="flex items-end gap-2">
            <textarea
              name="body"
              rows={2}
              value={composerValue}
              onChange={(event) => onComposerChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  const form = event.currentTarget.form;
                  if (form) form.requestSubmit();
                }
              }}
              required
              disabled={!canSend || sendPending}
              placeholder="Skriv en melding..."
              className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50/50 px-2.5 py-2 text-xs text-zinc-900 placeholder-zinc-400 outline-none ring-blue-500/25 transition focus:bg-white focus:ring-2 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!canSend || sendPending || composerValue.trim() === ""}
              className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {sendPending ? "Sender..." : "Send"}
            </button>
          </div>
          {sendError ? (
            <p className="mt-1 text-[11px] text-red-600">{sendError}</p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
