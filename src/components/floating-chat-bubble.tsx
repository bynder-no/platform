"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  acceptConversationRequest,
  declineConversationRequest,
  sendConversationMessage,
} from "@/app/messages/actions";

type ChatPreview = {
  id: string;
  otherName: string;
  preview: string;
  when: string;
  status: string;
  requesterId: string;
  recipientId: string;
  messages: Array<{
    id: string;
    senderId: string;
    body: string;
    createdAt: string | null;
  }>;
};

type FloatingChatBubbleProps = {
  chats: ChatPreview[];
  currentUserId: string;
};

const OPEN_CHAT_PANEL_EVENT = "bynder:chat-panel-open";
const CHAT_PANEL_STATE_EVENT = "bynder:chat-panel-state";

function formatMessageTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FloatingChatBubble({ chats, currentUserId }: FloatingChatBubbleProps) {
  const router = useRouter();
  const [isMessengerPanelOpen, setIsMessengerPanelOpen] = useState(false);
  const [isThreadBubbleOpen, setIsThreadBubbleOpen] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [composerValue, setComposerValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const [localThreads, setLocalThreads] = useState(chats);
  const [sendState, sendAction, sendPending] = useActionState(sendConversationMessage, null);

  const selectedThread = useMemo(
    () => localThreads.find((thread) => thread.id === selectedThreadId) ?? null,
    [localThreads, selectedThreadId],
  );

  useEffect(() => {
    setLocalThreads(chats);
  }, [chats]);

  useEffect(() => {
    const handleOpenPanel = () => {
      setIsMessengerPanelOpen(true);
    };
    window.addEventListener(OPEN_CHAT_PANEL_EVENT, handleOpenPanel);
    return () => window.removeEventListener(OPEN_CHAT_PANEL_EVENT, handleOpenPanel);
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(CHAT_PANEL_STATE_EVENT, {
        detail: { open: isMessengerPanelOpen || isThreadBubbleOpen },
      }),
    );
  }, [isMessengerPanelOpen, isThreadBubbleOpen]);

  useEffect(() => {
    if (!sendState?.success || !selectedThreadId) return;
    const body = composerValue.trim();
    if (!body) return;

    setLocalThreads((current) =>
      current.map((thread) =>
        thread.id === selectedThreadId
          ? {
              ...thread,
              preview: body,
              messages: [
                ...thread.messages,
                {
                  id: `local-${Date.now()}`,
                  senderId: currentUserId,
                  body,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : thread,
      ),
    );
    setComposerValue("");
    router.refresh();
  }, [sendState, selectedThreadId, composerValue, currentUserId, router]);

  const canSend =
    !!selectedThread &&
    (selectedThread.status === "accepted" ||
      (selectedThread.status === "pending" &&
        selectedThread.requesterId === currentUserId));
  const isRecipient =
    !!selectedThread &&
    selectedThread.status === "pending" &&
    selectedThread.recipientId === currentUserId;
  const isRequesterWaiting =
    !!selectedThread &&
    selectedThread.status === "pending" &&
    selectedThread.requesterId === currentUserId;

  const filteredThreads = useMemo(() => {
    const base =
      activeTab === "unread"
        ? localThreads.filter((thread) => thread.status === "pending")
        : localThreads;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return base;
    return base.filter((thread) => {
      const haystack = `${thread.otherName} ${thread.preview}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [activeTab, localThreads, searchQuery]);

  return (
    <>
      {isMessengerPanelOpen ? (
        <div className="fixed right-5 top-20 z-40 w-[400px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <h2 className="text-base font-semibold text-zinc-900">Chatter</h2>
            <button
              type="button"
              onClick={() => setIsMessengerPanelOpen(false)}
              className="rounded-md px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
              aria-label="Lukk chatter-panel"
            >
              Lukk
            </button>
          </div>
          <div className="border-b border-zinc-200 px-4 py-3">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Søk i chatter..."
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Søk i chatter"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  activeTab === "all"
                    ? "bg-blue-600 text-white"
                    : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                Alle
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("unread")}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  activeTab === "unread"
                    ? "bg-blue-600 text-white"
                    : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                Uleste
              </button>
            </div>
          </div>
          <ul className="max-h-[380px] overflow-y-auto">
            {filteredThreads.length === 0 ? (
              <li className="px-4 py-5 text-sm text-zinc-600">
                Ingen chatter å vise.
              </li>
            ) : (
              filteredThreads.map((chat) => (
                <li
                  key={chat.id}
                  className="border-b border-zinc-200 last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedThreadId(chat.id);
                      setIsThreadBubbleOpen(true);
                      setIsMessengerPanelOpen(false);
                    }}
                    className="block w-full px-4 py-3 text-left hover:bg-zinc-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-zinc-900">
                        {chat.otherName}
                      </p>
                      <span className="shrink-0 text-[11px] text-zinc-500">
                        {chat.when}
                      </span>
                    </div>
                    <p className="truncate text-xs text-zinc-600">{chat.preview}</p>
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="border-t border-zinc-200 px-4 py-2">
            <Link
              href="/messages"
              className="text-sm font-medium text-zinc-700 hover:underline"
              onClick={() => setIsMessengerPanelOpen(false)}
            >
              Se alle meldinger
            </Link>
          </div>
        </div>
      ) : null}

      {isThreadBubbleOpen && selectedThread ? (
        <div className="fixed bottom-20 right-5 z-40 w-[360px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
          <div className="flex h-[460px] flex-col">
            <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2">
              <button
                type="button"
                onClick={() => {
                  setIsThreadBubbleOpen(false);
                  setIsMessengerPanelOpen(true);
                }}
                className="rounded-md px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
              >
                Tilbake
              </button>
              <p className="truncate text-sm font-semibold text-zinc-900">
                {selectedThread.otherName}
              </p>
              <button
                type="button"
                onClick={() => setIsThreadBubbleOpen(false)}
                className="ml-auto rounded-md px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
              >
                Lukk
              </button>
            </div>
            <div className="border-b border-zinc-200 px-3 py-2">
              {isRecipient ? (
                <div className="flex items-center gap-2">
                  <form
                    action={async (formData) => {
                      await acceptConversationRequest(formData);
                      router.refresh();
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
                      router.refresh();
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
                <p className="text-xs text-zinc-600">
                  Venter på at brukeren godtar.
                </p>
              ) : null}
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
              {selectedThread.messages.length === 0 ? (
                <p className="text-xs text-zinc-600">
                  Ingen meldinger ennå.
                </p>
              ) : (
                selectedThread.messages.map((message) => {
                  const isOwn = message.senderId === currentUserId;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-xs ${
                          isOwn
                            ? "bg-blue-600 text-white"
                            : "bg-zinc-100 text-zinc-900"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.body}</p>
                        <p
                          className={`mt-1 text-[10px] ${
                            isOwn ? "text-blue-100" : "text-zinc-500"
                          }`}
                        >
                          {formatMessageTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <form
              action={sendAction}
              className="border-t border-zinc-200 px-3 py-2"
            >
              <input type="hidden" name="thread_id" value={selectedThread.id} />
              <div className="flex items-end gap-2">
                <textarea
                  name="body"
                  rows={2}
                  value={composerValue}
                  onChange={(event) => setComposerValue(event.target.value)}
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
                  className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-xs text-zinc-900 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!canSend || sendPending || composerValue.trim() === ""}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {sendPending ? "Sender..." : "Send"}
                </button>
              </div>
              {sendState?.error ? (
                <p className="mt-1 text-[11px] text-red-600">
                  {sendState.error}
                </p>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          if (selectedThreadId) {
            setIsThreadBubbleOpen((current) => !current);
            return;
          }
          setIsMessengerPanelOpen((current) => !current);
        }}
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-blue-700"
        aria-label="Åpne meldinger"
      >
        <span aria-hidden>💬</span>
        Chat
      </button>
    </>
  );
}
