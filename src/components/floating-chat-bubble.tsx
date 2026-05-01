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

function formatMessageTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FloatingChatBubble({ chats, currentUserId }: FloatingChatBubbleProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [composerValue, setComposerValue] = useState("");
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

  return (
    <>
      {open ? (
        <div className="fixed bottom-20 right-5 z-40 w-[360px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          {!selectedThread ? (
            <>
              <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Meldinger
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  aria-label="Lukk meldingspanel"
                >
                  Lukk
                </button>
              </div>
              <ul className="max-h-[320px] overflow-y-auto">
                {localThreads.length === 0 ? (
                  <li className="px-3 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                    Ingen meldinger ennå.
                  </li>
                ) : (
                  localThreads.map((chat) => (
                    <li
                      key={chat.id}
                      className="border-b border-zinc-200 last:border-b-0 dark:border-zinc-700"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedThreadId(chat.id)}
                        className="block w-full px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {chat.otherName}
                          </p>
                          <span className="shrink-0 text-[11px] text-zinc-500 dark:text-zinc-400">
                            {chat.when}
                          </span>
                        </div>
                        <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">
                          {chat.preview}
                        </p>
                      </button>
                    </li>
                  ))
                )}
              </ul>
              <div className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-700">
                <Link
                  href="/messages"
                  className="text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-300"
                  onClick={() => setOpen(false)}
                >
                  Se alle meldinger
                </Link>
              </div>
            </>
          ) : (
            <div className="flex h-[460px] flex-col">
              <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setSelectedThreadId(null)}
                  className="rounded-md px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Tilbake
                </button>
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {selectedThread.otherName}
                </p>
              </div>
              <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
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
                        className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
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
                        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
                      >
                        Avslå
                      </button>
                    </form>
                  </div>
                ) : isRequesterWaiting ? (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Venter på at brukeren godtar.
                  </p>
                ) : null}
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
                {selectedThread.messages.length === 0 ? (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
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
                              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                              : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{message.body}</p>
                          <p
                            className={`mt-1 text-[10px] ${
                              isOwn
                                ? "text-zinc-300 dark:text-zinc-500"
                                : "text-zinc-500 dark:text-zinc-400"
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
                className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-700"
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
                    className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none ring-zinc-400 focus:ring-2 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                  />
                  <button
                    type="submit"
                    disabled={!canSend || sendPending || composerValue.trim() === ""}
                    className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    {sendPending ? "Sender..." : "Send"}
                  </button>
                </div>
                {sendState?.error ? (
                  <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                    {sendState.error}
                  </p>
                ) : null}
              </form>
            </div>
          )}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        aria-label="Åpne meldinger"
      >
        <span aria-hidden>💬</span>
        Chat
      </button>
    </>
  );
}
