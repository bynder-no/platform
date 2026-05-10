"use client";

import { formatChatterListTime } from "@/lib/chatter-list-time";

import type { DealPreview, InboxThread } from "./floating-chat-types";

const LIST_PAGE_SIZE = 20;

type FloatingChatChatterPanelProps = {
  onClose: () => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  activeTab: "all" | "unread" | "requests" | "deals";
  onSelectTab: (tab: "all" | "unread" | "requests" | "deals") => void;
  shownThreads: InboxThread[];
  hasMoreInList: boolean;
  onLoadMore: () => void;
  onSelectThread: (chat: InboxThread) => void;
  countAlle: number;
  countUleste: number;
  countForespørsler: number;
  countDeals: number;
  listTabShowsUnreadDot: boolean;
};

function DealListItem({ deal }: { deal: DealPreview }) {
  return (
    <div className="block w-full px-4 py-3 text-left">
      <div className="flex gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
          {deal.listingImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={deal.listingImageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-500">
              Ingen
            </div>
          )}
          <span className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white bg-zinc-900 text-[10px] font-semibold text-white">
            {deal.otherName.slice(0, 1).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-1 text-sm font-medium text-zinc-900">{deal.listingTitle}</p>
            <span className="shrink-0 text-right text-[11px] tabular-nums text-zinc-500">
              {formatChatterListTime(deal.when)}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-zinc-600">{deal.preview}</p>
          {deal.statusBadge ? (
            <span
              className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                deal.statusTone === "action"
                  ? "bg-red-100 text-red-700"
                  : deal.statusTone === "wait"
                    ? "bg-green-100 text-green-700"
                    : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {deal.statusBadge}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function FloatingChatChatterPanel({
  onClose,
  searchQuery,
  onSearchQueryChange,
  activeTab,
  onSelectTab,
  shownThreads,
  hasMoreInList,
  onLoadMore,
  onSelectThread,
  countAlle,
  countUleste,
  countForespørsler,
  countDeals,
  listTabShowsUnreadDot,
}: FloatingChatChatterPanelProps) {
  return (
    <div className="fixed right-5 top-20 z-[55] w-[400px] overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xl shadow-zinc-900/10">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50/80 px-4 py-3">
        <h2 className="text-base font-semibold text-zinc-900">Chatter</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-200/80"
          aria-label="Lukk chatter-panel"
        >
          Lukk
        </button>
      </div>
      <div className="border-b border-zinc-100 px-4 py-3">
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Søk i chatter..."
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none ring-blue-500/30 transition focus:bg-white focus:ring-2"
          aria-label="Søk i chatter"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSelectTab("all")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              activeTab === "all"
                ? "bg-blue-600 text-white shadow-sm"
                : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            Alle ({countAlle})
          </button>
          <button
            type="button"
            onClick={() => onSelectTab("unread")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              activeTab === "unread"
                ? "bg-blue-600 text-white shadow-sm"
                : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            Uleste ({countUleste})
          </button>
          <button
            type="button"
            onClick={() => onSelectTab("requests")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              activeTab === "requests"
                ? "bg-blue-600 text-white shadow-sm"
                : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            Forespørsler ({countForespørsler})
          </button>
          <button
            type="button"
            onClick={() => onSelectTab("deals")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              activeTab === "deals"
                ? "bg-blue-600 text-white shadow-sm"
                : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            Deals ({countDeals})
          </button>
        </div>
      </div>
      <ul className="max-h-[380px] overflow-y-auto">
        {shownThreads.length === 0 ? (
          <li className="px-4 py-5 text-sm text-zinc-600">Ingen chatter å vise.</li>
        ) : (
          shownThreads.map((chat) => (
            <li key={chat.id} className="border-b border-zinc-100 last:border-b-0">
              <button
                type="button"
                onClick={() => onSelectThread(chat)}
                className="block w-full text-left transition hover:bg-zinc-50/90"
              >
                {chat.kind === "deal" ? (
                  <DealListItem deal={chat} />
                ) : (
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-sm font-medium text-zinc-900">
                          {chat.otherName}
                        </p>
                        {listTabShowsUnreadDot &&
                        String(chat.status) === "accepted" &&
                        chat.unreadCount > 0 ? (
                          <span
                            className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold text-white"
                            aria-label={`${chat.unreadCount} uleste`}
                          >
                            {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-right text-[11px] tabular-nums text-zinc-500">
                        {formatChatterListTime(chat.when)}
                      </span>
                    </div>
                    <p className="truncate text-xs text-zinc-600">{chat.preview}</p>
                  </div>
                )}
              </button>
            </li>
          ))
        )}
      </ul>
      <div className="border-t border-zinc-100 bg-zinc-50/50 px-4 py-2">
        {hasMoreInList ? (
          <button
            type="button"
            onClick={onLoadMore}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Vis flere
          </button>
        ) : (
          <p className="text-xs text-zinc-500">Alle samtaler i listen er vist.</p>
        )}
      </div>
    </div>
  );
}

export { LIST_PAGE_SIZE };
