"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  acceptConversationRequest,
  declineConversationRequest,
  markConversationThreadRead,
  sendConversationMessage,
} from "@/app/messages/actions";
import {
  CHAT_PANEL_STATE_EVENT,
  MESSAGES_INBOX_PANEL_OPEN_EVENT,
  OPEN_CHAT_PANEL_EVENT,
  OPEN_CHAT_THREAD_EVENT,
} from "@/lib/chat-panel-events";

type ChatPreview = {
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

type ChatPatch = Partial<ChatPreview> & {
  messages?: ChatPreview["messages"];
};

type FloatingChatBubbleProps = {
  chats: ChatPreview[];
  currentUserId: string;
};

const LIST_PAGE_SIZE = 20;

function formatMessageTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FloatingChatBubble({ chats, currentUserId }: FloatingChatBubbleProps) {
  const router = useRouter();
  const uid = String(currentUserId);
  const [isMessengerPanelOpen, setIsMessengerPanelOpen] = useState(false);
  const [isThreadBubbleOpen, setIsThreadBubbleOpen] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [composerValue, setComposerValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "requests">("all");
  const [listCap, setListCap] = useState(LIST_PAGE_SIZE);
  const [sendPending, setSendPending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  /** Optimistic UI layered on server merge (send / accept). */
  const [threadPatches, setThreadPatches] = useState<Record<string, ChatPatch>>({});
  /** Threads removed locally after decline until next server refresh. */
  const [hiddenThreadIds, setHiddenThreadIds] = useState(() => new Set<string>());

  const mergeSourceRef = useRef<ChatPreview[] | null>(null);
  /** Scroll container for the open thread message list (not the conversation list). */
  const threadMessagesScrollRef = useRef<HTMLDivElement | null>(null);
  const threadMessagesEndRef = useRef<HTMLDivElement | null>(null);

  const mergedThreads = useMemo(() => {
    const prevRows =
      mergeSourceRef.current !== null && mergeSourceRef.current.length > 0
        ? mergeSourceRef.current
        : chats;
    const next = chats.map((incoming) => {
      const prevRow = prevRows.find((t) => String(t.id) === String(incoming.id));
      const isOpenThread =
        selectedThreadId && String(incoming.id) === String(selectedThreadId);
      if (
        isOpenThread &&
        prevRow &&
        prevRow.unreadCount === 0 &&
        incoming.unreadCount > 0
      ) {
        return { ...incoming, unreadCount: 0 };
      }
      return incoming;
    });
    mergeSourceRef.current = next;
    return next;
  }, [chats, selectedThreadId]);

  const patchedThreads = useMemo(() => {
    return mergedThreads.map((t) => {
      const patch = threadPatches[String(t.id)];
      if (!patch) return t;
      return {
        ...t,
        ...patch,
        messages: patch.messages ?? t.messages,
      };
    });
  }, [mergedThreads, threadPatches]);

  const localThreads = useMemo(() => {
    return patchedThreads.filter((t) => !hiddenThreadIds.has(String(t.id)));
  }, [patchedThreads, hiddenThreadIds]);

  const selectedThread = useMemo(
    () => localThreads.find((thread) => String(thread.id) === String(selectedThreadId)) ?? null,
    [localThreads, selectedThreadId],
  );

  /** Drives scroll-to-bottom when message set changes (open thread, new message, optimistic send). */
  const threadMessagesScrollKey = useMemo(() => {
    if (!selectedThread) return "";
    return selectedThread.messages.map((m) => m.id).join("\u0001");
  }, [selectedThread]);

  const scrollThreadMessagesToBottom = useCallback(() => {
    const run = () => {
      const root = threadMessagesScrollRef.current;
      if (root) {
        root.scrollTop = root.scrollHeight;
      }
      threadMessagesEndRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
    };
    run();
    requestAnimationFrame(run);
  }, []);

  useLayoutEffect(() => {
    if (!isThreadBubbleOpen || !selectedThreadId) return;
    if (!threadMessagesScrollKey) return;
    scrollThreadMessagesToBottom();
  }, [
    isThreadBubbleOpen,
    selectedThreadId,
    threadMessagesScrollKey,
    scrollThreadMessagesToBottom,
  ]);

  useEffect(() => {
    const handleOpenPanel = () => {
      setIsMessengerPanelOpen(true);
    };
    window.addEventListener(OPEN_CHAT_PANEL_EVENT, handleOpenPanel);
    return () => window.removeEventListener(OPEN_CHAT_PANEL_EVENT, handleOpenPanel);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const id = (event as CustomEvent<{ threadId?: string }>).detail?.threadId?.trim();
      if (!id) return;
      setSelectedThreadId(id);
      setIsThreadBubbleOpen(true);
      setIsMessengerPanelOpen(false);
      setThreadPatches((prev) => {
        const row = mergedThreads.find((t) => String(t.id) === id);
        if (!row || String(row.status) !== "accepted") return prev;
        return { ...prev, [id]: { ...prev[id], unreadCount: 0 } };
      });
      void markConversationThreadRead(id).then(() => router.refresh());
    };
    window.addEventListener(OPEN_CHAT_THREAD_EVENT, handler as EventListener);
    return () =>
      window.removeEventListener(OPEN_CHAT_THREAD_EVENT, handler as EventListener);
  }, [router, mergedThreads]);

  useEffect(() => {
    if (!isMessengerPanelOpen) return;
    window.dispatchEvent(new CustomEvent(MESSAGES_INBOX_PANEL_OPEN_EVENT));
  }, [isMessengerPanelOpen]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(CHAT_PANEL_STATE_EVENT, {
        detail: { open: isMessengerPanelOpen || isThreadBubbleOpen },
      }),
    );
  }, [isMessengerPanelOpen, isThreadBubbleOpen]);

  function selectTab(next: "all" | "unread" | "requests") {
    setActiveTab(next);
    setListCap(LIST_PAGE_SIZE);
  }

  function updateSearchQuery(next: string) {
    setSearchQuery(next);
    setListCap(LIST_PAGE_SIZE);
  }

  function openThreadFromRow(chat: ChatPreview) {
    const id = chat.id;
    setSelectedThreadId(id);
    setIsThreadBubbleOpen(true);
    setIsMessengerPanelOpen(false);
    if (String(chat.status) === "accepted") {
      setThreadPatches((prev) => ({
        ...prev,
        [id]: { ...prev[id], unreadCount: 0 },
      }));
    }
    void markConversationThreadRead(id).then(() => router.refresh());
  }

  const canSend =
    !!selectedThread &&
    (String(selectedThread.status) === "accepted" ||
      (String(selectedThread.status) === "pending" &&
        String(selectedThread.requesterId) === uid));
  const isRecipient =
    !!selectedThread &&
    String(selectedThread.status) === "pending" &&
    String(selectedThread.recipientId) === uid;
  const isRequesterWaiting =
    !!selectedThread &&
    String(selectedThread.status) === "pending" &&
    String(selectedThread.requesterId) === uid;

  const filteredThreads = useMemo(() => {
    let base = localThreads;
    if (activeTab === "requests") {
      base = localThreads.filter(
        (thread) =>
          String(thread.status) === "pending" && String(thread.recipientId) === uid,
      );
    } else if (activeTab === "unread") {
      base = localThreads.filter(
        (thread) =>
          String(thread.status) === "accepted" &&
          thread.unreadCount > 0,
      );
    } else {
      base = localThreads.filter(
        (thread) =>
          String(thread.status) === "accepted" ||
          (String(thread.status) === "pending" && String(thread.requesterId) === uid),
      );
    }
    const query = searchQuery.trim().toLowerCase();
    if (!query) return base;
    return base.filter((thread) => {
      const haystack = `${thread.otherName} ${thread.preview}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [activeTab, localThreads, searchQuery, uid]);

  const shownThreads = useMemo(
    () => filteredThreads.slice(0, listCap),
    [filteredThreads, listCap],
  );
  const hasMoreInList = filteredThreads.length > shownThreads.length;

  const countAlle = useMemo(
    () =>
      localThreads.filter(
        (t) =>
          String(t.status) === "accepted" ||
          (String(t.status) === "pending" && String(t.requesterId) === uid),
      ).length,
    [localThreads, uid],
  );
  const countUleste = useMemo(
    () =>
      localThreads.filter(
        (t) => String(t.status) === "accepted" && t.unreadCount > 0,
      ).length,
    [localThreads],
  );
  const countForespørsler = useMemo(
    () =>
      localThreads.filter(
        (t) => String(t.status) === "pending" && String(t.recipientId) === uid,
      ).length,
    [localThreads, uid],
  );

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
              onChange={(event) => updateSearchQuery(event.target.value)}
              placeholder="Søk i chatter..."
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Søk i chatter"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => selectTab("all")}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  activeTab === "all"
                    ? "bg-blue-600 text-white"
                    : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                Alle ({countAlle})
              </button>
              <button
                type="button"
                onClick={() => selectTab("unread")}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  activeTab === "unread"
                    ? "bg-blue-600 text-white"
                    : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                Uleste ({countUleste})
              </button>
              <button
                type="button"
                onClick={() => selectTab("requests")}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  activeTab === "requests"
                    ? "bg-blue-600 text-white"
                    : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                Forespørsler ({countForespørsler})
              </button>
            </div>
          </div>
          <ul className="max-h-[380px] overflow-y-auto">
            {shownThreads.length === 0 ? (
              <li className="px-4 py-5 text-sm text-zinc-600">
                Ingen chatter å vise.
              </li>
            ) : (
              shownThreads.map((chat) => (
                <li
                  key={chat.id}
                  className="border-b border-zinc-200 last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => openThreadFromRow(chat)}
                    className="block w-full px-4 py-3 text-left hover:bg-zinc-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-sm font-medium text-zinc-900">
                          {chat.otherName}
                        </p>
                        {activeTab === "all" &&
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
            {hasMoreInList ? (
              <button
                type="button"
                onClick={() => setListCap((c) => c + LIST_PAGE_SIZE)}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Vis flere
              </button>
            ) : (
              <p className="text-xs text-zinc-500">
                Alle samtaler i listen er vist.
              </p>
            )}
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
                      const tid = String(formData.get("thread_id") ?? "");
                      setThreadPatches((prev) => ({
                        ...prev,
                        [tid]: {
                          ...prev[tid],
                          status: "accepted",
                          unreadCount: 0,
                        },
                      }));
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
                      const tid = String(formData.get("thread_id") ?? "");
                      setHiddenThreadIds((prev) => new Set(prev).add(tid));
                      setIsThreadBubbleOpen(false);
                      setSelectedThreadId(null);
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
                  Venter på godkjenning.
                </p>
              ) : null}
            </div>
            <div
              ref={threadMessagesScrollRef}
              className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3"
            >
              {selectedThread.messages.length === 0 ? (
                <p className="text-xs text-zinc-600">
                  Ingen meldinger ennå.
                </p>
              ) : (
                selectedThread.messages.map((message) => {
                  const isOwn = String(message.senderId) === uid;
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
              <div
                ref={threadMessagesEndRef}
                className="h-0 w-full shrink-0"
                aria-hidden
              />
            </div>
            <form
              action={async (formData) => {
                setSendPending(true);
                setSendError(null);
                try {
                  const result = await sendConversationMessage(null, formData);
                  if (result?.error) {
                    setSendError(result.error);
                    return;
                  }
                  if (!result?.success || !selectedThread) return;
                  const body = String(formData.get("body") ?? "").trim();
                  if (!body) return;
                  setThreadPatches((prev) => ({
                    ...prev,
                    [selectedThread.id]: {
                      ...prev[selectedThread.id],
                      preview: body,
                      messages: [
                        ...selectedThread.messages,
                        {
                          id: `local-${Date.now()}`,
                          senderId: currentUserId,
                          body,
                          createdAt: new Date().toISOString(),
                        },
                      ],
                    },
                  }));
                  setComposerValue("");
                  router.refresh();
                } finally {
                  setSendPending(false);
                }
              }}
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
              {sendError ? (
                <p className="mt-1 text-[11px] text-red-600">
                  {sendError}
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
