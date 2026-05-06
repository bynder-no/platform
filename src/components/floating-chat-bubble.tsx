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

import { markConversationThreadRead, sendConversationMessage } from "@/app/messages/actions";
import { sendListingDealMessage } from "@/app/my-auctions/[id]/actions";
import {
  CHAT_PANEL_STATE_EVENT,
  CLOSE_MESSAGES_INBOX_PANEL_EVENT,
  CLOSE_NOTIFICATIONS_PANEL_EVENT,
  MESSAGES_INBOX_PANEL_OPEN_EVENT,
  OPEN_CHAT_PANEL_EVENT,
  OPEN_CHAT_THREAD_EVENT,
} from "@/lib/chat-panel-events";

import {
  FloatingChatChatterPanel,
  LIST_PAGE_SIZE,
} from "./floating-chat/floating-chat-chatter-panel";
import type {
  ChatPatch,
  ChatPreview,
  DealPreview,
  InboxThread,
} from "./floating-chat/floating-chat-types";
import { FloatingChatThreadWindow } from "./floating-chat/floating-chat-thread-window";

export type { InboxThread } from "./floating-chat/floating-chat-types";

type FloatingChatBubbleProps = {
  chats: InboxThread[];
  currentUserId: string;
};

type ChatStack = {
  activeThreadId: string | null;
  /** Index 0 = pill directly above the active window */
  minimizedThreadIds: string[];
};

function pushPreviousToMinimized(
  prev: ChatStack,
  nextActiveId: string,
): ChatStack {
  let minimized = prev.minimizedThreadIds.filter((x) => String(x) !== nextActiveId);
  if (prev.activeThreadId && String(prev.activeThreadId) !== String(nextActiveId)) {
    const pa = String(prev.activeThreadId);
    if (!minimized.includes(pa)) {
      minimized = [pa, ...minimized];
    }
  }
  return { activeThreadId: nextActiveId, minimizedThreadIds: minimized };
}

function mergeChatPreview(
  incoming: ChatPreview,
  prevRow: InboxThread | undefined,
  isOpenThread: boolean,
): ChatPreview {
  if (isOpenThread && prevRow && prevRow.unreadCount === 0 && incoming.unreadCount > 0) {
    return { ...incoming, kind: "chat" as const, unreadCount: 0 };
  }
  return { ...incoming, kind: "chat" as const };
}

function mergeDealPreview(incoming: DealPreview): DealPreview {
  return { ...incoming, kind: "deal" as const };
}

function applyChatPatch(thread: ChatPreview, patch: ChatPatch): ChatPreview {
  return {
    ...thread,
    ...patch,
    kind: "chat" as const,
    messages: patch.messages ?? thread.messages,
  };
}

function applyDealPatch(thread: DealPreview, patch: ChatPatch): DealPreview {
  return {
    ...thread,
    ...patch,
    kind: "deal" as const,
    messages: patch.messages ?? thread.messages,
  };
}

export function FloatingChatBubble({ chats, currentUserId }: FloatingChatBubbleProps) {
  const router = useRouter();
  const uid = String(currentUserId);
  const [isMessengerPanelOpen, setIsMessengerPanelOpen] = useState(false);
  const [chatStack, setChatStack] = useState<ChatStack>({
    activeThreadId: null,
    minimizedThreadIds: [],
  });
  const { activeThreadId, minimizedThreadIds } = chatStack;

  const [composerByThreadId, setComposerByThreadId] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "requests" | "deals">("all");
  const [listCap, setListCap] = useState(LIST_PAGE_SIZE);
  const [sendPending, setSendPending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [threadPatches, setThreadPatches] = useState<Record<string, ChatPatch>>({});
  const [hiddenThreadIds, setHiddenThreadIds] = useState(() => new Set<string>());

  const mergeSourceRef = useRef<InboxThread[] | null>(null);
  const mergedThreadsForEventRef = useRef<InboxThread[]>(chats);
  const threadMessagesScrollRef = useRef<HTMLDivElement | null>(null);
  const threadMessagesEndRef = useRef<HTMLDivElement | null>(null);

  const mergedThreads = useMemo(() => {
    const prevRows =
      mergeSourceRef.current !== null && mergeSourceRef.current.length > 0
        ? mergeSourceRef.current
        : chats;
    const next: InboxThread[] = chats.map((incoming) => {
      const prevRow = prevRows.find((t) => String(t.id) === String(incoming.id));
      const isOpenThread =
        activeThreadId && String(incoming.id) === String(activeThreadId);
      if (incoming.kind === "chat") {
        return mergeChatPreview(incoming, prevRow, Boolean(isOpenThread));
      }
      return mergeDealPreview(incoming);
    });
    mergeSourceRef.current = next;
    return next;
  }, [chats, activeThreadId]);

  mergedThreadsForEventRef.current = mergedThreads;

  const patchedThreads = useMemo(() => {
    const next: InboxThread[] = mergedThreads.map((t) => {
      const patch = threadPatches[String(t.id)];
      if (!patch) return t;
      if (t.kind === "chat") {
        return applyChatPatch(t, patch);
      }
      return applyDealPatch(t, patch);
    });
    return next;
  }, [mergedThreads, threadPatches]);

  const localThreads = useMemo(() => {
    return patchedThreads.filter((t) => !hiddenThreadIds.has(String(t.id)));
  }, [patchedThreads, hiddenThreadIds]);

  const activeThread = useMemo<InboxThread | undefined>(
    () =>
      activeThreadId
        ? localThreads.find((thread) => String(thread.id) === String(activeThreadId))
        : undefined,
    [localThreads, activeThreadId],
  );

  const threadMessagesScrollKey = useMemo(() => {
    if (!activeThread) return "";
    return activeThread.messages.map((m) => m.id).join("\u0001");
  }, [activeThread]);

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
    if (!activeThreadId || !activeThread) return;
    if (!threadMessagesScrollKey) return;
    scrollThreadMessagesToBottom();
  }, [
    activeThreadId,
    activeThread,
    threadMessagesScrollKey,
    scrollThreadMessagesToBottom,
  ]);

  useEffect(() => {
    const ids = new Set(localThreads.map((t) => String(t.id)));
    setChatStack((prev) => ({
      activeThreadId:
        prev.activeThreadId && ids.has(String(prev.activeThreadId))
          ? prev.activeThreadId
          : null,
      minimizedThreadIds: prev.minimizedThreadIds.filter((id) => ids.has(String(id))),
    }));
  }, [localThreads]);

  useEffect(() => {
    const handleOpenPanel = () => {
      window.dispatchEvent(new CustomEvent(CLOSE_NOTIFICATIONS_PANEL_EVENT));
      setIsMessengerPanelOpen(true);
    };
    const handleCloseInbox = () => {
      setIsMessengerPanelOpen(false);
    };
    window.addEventListener(OPEN_CHAT_PANEL_EVENT, handleOpenPanel);
    window.addEventListener(CLOSE_MESSAGES_INBOX_PANEL_EVENT, handleCloseInbox);
    return () => {
      window.removeEventListener(OPEN_CHAT_PANEL_EVENT, handleOpenPanel);
      window.removeEventListener(CLOSE_MESSAGES_INBOX_PANEL_EVENT, handleCloseInbox);
    };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const id = (event as CustomEvent<{ threadId?: string }>).detail?.threadId?.trim();
      if (!id) return;
      setIsMessengerPanelOpen(false);
      setChatStack((prev) => pushPreviousToMinimized(prev, id));
      const rows = mergedThreadsForEventRef.current;
      const row = rows.find((t) => String(t.id) === id);
      if (row && row.kind === "chat" && String(row.status) === "accepted") {
        setThreadPatches((p) => ({
          ...p,
          [id]: { ...p[id], unreadCount: 0 },
        }));
      }
      void markConversationThreadRead(id).then(() => router.refresh());
    };
    window.addEventListener(OPEN_CHAT_THREAD_EVENT, handler as EventListener);
    return () =>
      window.removeEventListener(OPEN_CHAT_THREAD_EVENT, handler as EventListener);
  }, [router]);

  useEffect(() => {
    if (!isMessengerPanelOpen) return;
    window.dispatchEvent(new CustomEvent(MESSAGES_INBOX_PANEL_OPEN_EVENT));
  }, [isMessengerPanelOpen]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(CHAT_PANEL_STATE_EVENT, {
        detail: { open: isMessengerPanelOpen },
      }),
    );
  }, [isMessengerPanelOpen]);

  function selectTab(next: "all" | "unread" | "requests" | "deals") {
    setActiveTab(next);
    setListCap(LIST_PAGE_SIZE);
  }

  function updateSearchQuery(next: string) {
    setSearchQuery(next);
    setListCap(LIST_PAGE_SIZE);
  }

  function openThreadFromRow(chat: InboxThread) {
    const id = String(chat.id);
    setIsMessengerPanelOpen(false);
    setChatStack((prev) => pushPreviousToMinimized(prev, id));
    if (chat.kind === "chat" && String(chat.status) === "accepted") {
      setThreadPatches((prev) => ({
        ...prev,
        [id]: { ...prev[id], unreadCount: 0 },
      }));
    }
    if (chat.kind === "chat") {
      void markConversationThreadRead(id).then(() => router.refresh());
    }
  }

  function handleMinimizeActive() {
    if (!activeThreadId) return;
    const id = String(activeThreadId);
    setChatStack((prev) => {
      const without = prev.minimizedThreadIds.filter((x) => String(x) !== id);
      return {
        activeThreadId: null,
        minimizedThreadIds: [id, ...without],
      };
    });
  }

  function handleCloseThread(threadId: string) {
    const id = String(threadId);
    setChatStack((prev) => ({
      activeThreadId:
        prev.activeThreadId && String(prev.activeThreadId) === id
          ? null
          : prev.activeThreadId,
      minimizedThreadIds: prev.minimizedThreadIds.filter((x) => String(x) !== id),
    }));
    setComposerByThreadId((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function handleRestoreMinimized(threadId: string) {
    const id = String(threadId);
    setChatStack((prev) => pushPreviousToMinimized(prev, id));
  }

  const filteredThreads = useMemo(() => {
    let base = localThreads;
    if (activeTab === "requests") {
      base = localThreads.filter(
        (thread) =>
          thread.kind === "chat" &&
          String(thread.status) === "pending" && String(thread.recipientId) === uid,
      );
    } else if (activeTab === "unread") {
      base = localThreads.filter(
        (thread) =>
          thread.kind === "chat" &&
          String(thread.status) === "accepted" &&
          thread.unreadCount > 0,
      );
    } else if (activeTab === "deals") {
      base = localThreads.filter((thread) => thread.kind === "deal");
    } else {
      base = localThreads.filter(
        (thread) =>
          thread.kind === "chat" &&
          (String(thread.status) === "accepted" ||
            (String(thread.status) === "pending" && String(thread.requesterId) === uid)),
      );
    }
    const query = searchQuery.trim().toLowerCase();
    if (!query) return base;
    return base.filter((thread) => {
      const haystack =
        thread.kind === "deal"
          ? `${thread.otherName} ${thread.listingTitle} ${thread.preview}`.toLowerCase()
          : `${thread.otherName} ${thread.preview}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [activeTab, localThreads, searchQuery, uid]);

  const shownThreads = useMemo<InboxThread[]>(
    () => filteredThreads.slice(0, listCap),
    [filteredThreads, listCap],
  );
  const hasMoreInList = filteredThreads.length > shownThreads.length;

  const countAlle = useMemo(
    () =>
      localThreads.filter(
        (t) =>
          t.kind === "chat" &&
          (String(t.status) === "accepted" ||
            (String(t.status) === "pending" && String(t.requesterId) === uid)),
      ).length,
    [localThreads, uid],
  );
  const countUleste = useMemo(
    () =>
      localThreads.filter(
        (t) => t.kind === "chat" && String(t.status) === "accepted" && t.unreadCount > 0,
      ).length,
    [localThreads],
  );
  const countForespørsler = useMemo(
    () =>
      localThreads.filter(
        (t) =>
          t.kind === "chat" &&
          String(t.status) === "pending" &&
          String(t.recipientId) === uid,
      ).length,
    [localThreads, uid],
  );
  const countDeals = useMemo(
    () => localThreads.filter((t) => t.kind === "deal").length,
    [localThreads],
  );

  const onSubmitSend = useCallback(
    async (formData: FormData) => {
      if (!activeThread) return;
      setSendPending(true);
      setSendError(null);
      try {
        let result: { error?: string; success?: boolean } | null = null;
        if (activeThread.kind === "deal") {
          formData.set("inbox_context", "1");
          result = await sendListingDealMessage(null, formData);
        } else {
          result = await sendConversationMessage(null, formData);
        }
        if (result?.error) {
          setSendError(result.error);
          return;
        }
        if (!result?.success) return;
        const body = String(formData.get("body") ?? "").trim();
        if (!body) return;
        setThreadPatches((prev) => ({
          ...prev,
          [activeThread.id]: {
            ...prev[activeThread.id],
            preview: body,
            messages: [
              ...activeThread.messages,
              {
                id: `local-${Date.now()}`,
                senderId: currentUserId,
                body,
                createdAt: new Date().toISOString(),
              },
            ],
          },
        }));
        setComposerByThreadId((prev) => ({ ...prev, [String(activeThread.id)]: "" }));
        router.refresh();
      } finally {
        setSendPending(false);
      }
    },
    [activeThread, currentUserId, router],
  );

  return (
    <>
      {isMessengerPanelOpen ? (
        <FloatingChatChatterPanel
          onClose={() => setIsMessengerPanelOpen(false)}
          searchQuery={searchQuery}
          onSearchQueryChange={updateSearchQuery}
          activeTab={activeTab}
          onSelectTab={selectTab}
          shownThreads={shownThreads}
          hasMoreInList={hasMoreInList}
          onLoadMore={() => setListCap((c) => c + LIST_PAGE_SIZE)}
          onSelectThread={openThreadFromRow}
          countAlle={countAlle}
          countUleste={countUleste}
          countForespørsler={countForespørsler}
          countDeals={countDeals}
          listTabShowsUnreadDot={activeTab === "all"}
        />
      ) : null}

      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col-reverse items-end gap-2">
        {activeThread ? (
          <FloatingChatThreadWindow
            key={activeThread.id}
            thread={activeThread}
            currentUserId={currentUserId}
            minimized={false}
            onMinimize={handleMinimizeActive}
            onClose={() => handleCloseThread(activeThread.id)}
            onRestoreFromMinimized={() => {}}
            composerValue={composerByThreadId[String(activeThread.id)] ?? ""}
            onComposerChange={(value) =>
              setComposerByThreadId((prev) => ({
                ...prev,
                [String(activeThread.id)]: value,
              }))
            }
            sendPending={sendPending}
            sendError={sendError}
            threadMessagesScrollRef={threadMessagesScrollRef}
            threadMessagesEndRef={threadMessagesEndRef}
            onAfterDecline={() => {}}
            onThreadPatch={(tid, patch) => {
              setThreadPatches((prev) => ({
                ...prev,
                [tid]: { ...prev[tid], ...patch },
              }));
            }}
            onHideThread={(tid) => {
              setHiddenThreadIds((prev) => new Set(prev).add(tid));
              handleCloseThread(tid);
            }}
            routerRefresh={() => router.refresh()}
            onSubmitSend={onSubmitSend}
          />
        ) : null}

        {minimizedThreadIds.map((tid) => {
          const thread = localThreads.find((t) => String(t.id) === String(tid));
          if (!thread) return null;
          return (
            <FloatingChatThreadWindow
              key={`min-${thread.id}`}
              thread={thread}
              currentUserId={currentUserId}
              minimized
              onMinimize={() => {}}
              onClose={() => handleCloseThread(thread.id)}
              onRestoreFromMinimized={() => handleRestoreMinimized(thread.id)}
              composerValue=""
              onComposerChange={() => {}}
              sendPending={false}
              sendError={null}
              threadMessagesScrollRef={null}
              threadMessagesEndRef={null}
              onAfterDecline={() => {}}
              onThreadPatch={(tid, patch) => {
                setThreadPatches((prev) => ({
                  ...prev,
                  [tid]: { ...prev[tid], ...patch },
                }));
              }}
              onHideThread={(id) => {
                setHiddenThreadIds((prev) => new Set(prev).add(id));
                handleCloseThread(id);
              }}
              routerRefresh={() => router.refresh()}
              onSubmitSend={async () => {}}
            />
          );
        })}
      </div>
    </>
  );
}
