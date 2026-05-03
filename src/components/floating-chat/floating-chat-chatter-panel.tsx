"use client";

import type { ChatPreview } from "./floating-chat-types";

const LIST_PAGE_SIZE = 20;

type FloatingChatChatterPanelProps = {
  onClose: () => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  activeTab: "all" | "unread" | "requests";
  onSelectTab: (tab: "all" | "unread" | "requests") => void;
  shownThreads: ChatPreview[];
  hasMoreInList: boolean;
  onLoadMore: () => void;
  onSelectThread: (chat: ChatPreview) => void;
  countAlle: number;
  countUleste: number;
  countForespørsler: number;
  listTabShowsUnreadDot: boolean;
};

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
                className="block w-full px-4 py-3 text-left transition hover:bg-zinc-50/90"
              >
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
                  <span className="shrink-0 text-[11px] text-zinc-500">{chat.when}</span>
                </div>
                <p className="truncate text-xs text-zinc-600">{chat.preview}</p>
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
