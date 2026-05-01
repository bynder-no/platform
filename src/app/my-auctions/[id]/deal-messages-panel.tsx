"use client";

import { useMemo, useState } from "react";

type DealMessage = {
  id: string;
  body: string | null;
  sender_id: string | null;
  created_at: string | null;
};

type DealMessagesPanelProps = {
  messages: DealMessage[];
  currentUserId: string;
};

const searchInputClass =
  "mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none";

export function DealMessagesPanel({
  messages,
  currentUserId,
}: DealMessagesPanelProps) {
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLocaleLowerCase();

  const filteredMessages = useMemo(() => {
    if (normalizedQuery === "") return messages;
    return messages.filter((m) =>
      String(m.body ?? "").toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [messages, normalizedQuery]);

  return (
    <div>
      <label htmlFor="deal-room-search" className="sr-only">
        Søk i dealen
      </label>
      <input
        id="deal-room-search"
        name="deal-room-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Søk i dealen"
        className={searchInputClass}
      />

      {messages.length === 0 ? (
        <p className="mt-2 text-zinc-600">Ingen meldinger ennå.</p>
      ) : filteredMessages.length === 0 ? (
        <p className="mt-2 text-zinc-600">
          Ingen meldinger matcher søket.
        </p>
      ) : (
        <ul className="mt-3 space-y-3 border-t border-zinc-200 pt-3">
          {filteredMessages.map((m) => {
            const when = m.created_at ? new Date(m.created_at).toLocaleString() : "—";
            const label = m.sender_id === currentUserId ? "Deg" : "Motpart";
            return (
              <li key={m.id} className="text-sm">
                <p className="font-medium text-zinc-800">
                  {label}
                  <span className="mx-2 font-normal text-zinc-400">
                    ·
                  </span>
                  <span className="font-normal text-zinc-500">
                    {when}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-zinc-700">
                  {String(m.body ?? "").trim() || "—"}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
