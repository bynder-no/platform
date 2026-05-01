"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type InboxItem = {
  id: string;
  otherName: string;
  preview: string;
  when: string;
  isPendingRequest: boolean;
  hasUnread: boolean;
};

type MessagesInboxViewProps = {
  inboxItems: InboxItem[];
  requestItems: InboxItem[];
};

type Tab = "inbox" | "requests";

function itemMatchesSearch(item: InboxItem, query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    item.otherName.toLowerCase().includes(q) || item.preview.toLowerCase().includes(q)
  );
}

function RowItem({ item }: { item: InboxItem }) {
  return (
    <li className="border-b border-zinc-200 last:border-b-0">
      <Link
        href={`/messages/${item.id}`}
        className="flex items-center justify-between gap-3 px-3 py-3 transition hover:bg-zinc-50"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-zinc-900">
              {item.otherName}
            </p>
            {item.hasUnread ? (
              <span
                className="inline-block h-2 w-2 rounded-full bg-blue-500"
                aria-label="Ulest"
                title="Ulest"
              />
            ) : null}
          </div>
          <p className="truncate text-xs text-zinc-600">
            {item.preview}
          </p>
        </div>
        <div className="shrink-0 text-[11px] text-zinc-500">
          {item.when}
        </div>
      </Link>
    </li>
  );
}

export function MessagesInboxView({
  inboxItems,
  requestItems,
}: MessagesInboxViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>("inbox");
  const [search, setSearch] = useState("");

  const filteredInbox = useMemo(
    () => inboxItems.filter((item) => itemMatchesSearch(item, search)),
    [inboxItems, search],
  );
  const filteredRequests = useMemo(
    () => requestItems.filter((item) => itemMatchesSearch(item, search)),
    [requestItems, search],
  );

  const visibleItems = activeTab === "inbox" ? filteredInbox : filteredRequests;
  const emptyMessage =
    activeTab === "inbox" ? "Ingen aktive samtaler." : "Ingen nye forespørsler.";

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-4 py-4">
        <h2 className="text-lg font-semibold text-zinc-900">Meldinger</h2>
        <div className="mt-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Søk i meldinger..."
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Søk i meldinger"
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("inbox")}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              activeTab === "inbox"
                ? "bg-blue-600 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            Innboks ({inboxItems.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("requests")}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              activeTab === "requests"
                ? "bg-blue-600 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            Forespørsler ({requestItems.length})
          </button>
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <p className="px-4 py-6 text-sm text-zinc-600">{emptyMessage}</p>
      ) : (
        <ul>
          {visibleItems.map((item) => (
            <RowItem key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
