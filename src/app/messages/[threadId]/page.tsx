import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SignedInNavLinks } from "@/components/signed-in-nav-links";
import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";

import {
  acceptConversationRequest,
  declineConversationRequest,
} from "../actions";
import { ThreadMessageForm } from "../thread-message-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ threadId: string }>;
};

function profileLabel(
  p:
    | { display_name: string | null; username: string | null }
    | undefined
    | null,
) {
  if (!p) return "Medlem";
  return p.display_name?.trim() || p.username?.trim() || "Medlem";
}

export default async function MessageThreadPage({ params }: PageProps) {
  const { threadId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: thread, error: threadError } = await supabase
    .from("conversation_threads")
    .select("id, requester_id, recipient_id, status, created_at, updated_at")
    .eq("id", threadId)
    .maybeSingle();

  if (threadError) {
    throw new Error(`Could not load conversation thread: ${threadError.message}`);
  }
  if (!thread) {
    notFound();
  }

  const isParticipant =
    thread.requester_id === user.id || thread.recipient_id === user.id;
  if (!isParticipant) {
    notFound();
  }

  const otherUserId =
    thread.requester_id === user.id ? thread.recipient_id : thread.requester_id;
  const isRequester = thread.requester_id === user.id;
  const isRecipient = thread.recipient_id === user.id;

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .in("id", [thread.requester_id, thread.recipient_id, otherUserId]);
  if (profilesError) {
    throw new Error(`Could not load chat profiles: ${profilesError.message}`);
  }
  const profileById = new Map(
    (profiles ?? []).map((p) => [String(p.id), p] as const),
  );
  const otherProfile = profileById.get(String(otherUserId));
  const otherName = profileLabel(otherProfile);
  const otherUsername = String(otherProfile?.username ?? "").trim();
  const otherProfileHref =
    otherUsername !== "" ? `/u/${encodeURIComponent(otherUsername)}` : null;

  const { data: messageRows, error: messagesError } = await supabase
    .from("conversation_messages")
    .select("id, sender_id, body, created_at")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: true });
  if (messagesError) {
    throw new Error(`Could not load conversation messages: ${messagesError.message}`);
  }

  const canSend =
    thread.status === "accepted" ||
    (thread.status === "pending" && isRequester);

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <div className="flex items-center gap-2">
          <h1 className={pageTitleClass}>Chat</h1>
          {otherProfileHref ? (
            <Link
              href={otherProfileHref}
              className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
            >
              {otherName}
            </Link>
          ) : (
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {otherName}
            </span>
          )}
        </div>
        <SignedInNavLinks />
      </header>

      <section className={pageBodyGapClass}>
        <div className="flex h-[calc(100dvh-220px)] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{otherName}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Samtale</p>
          </div>

          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
            {thread.status === "pending" ? (
              isRecipient ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    Denne meldingen er en forespørsel.
                  </p>
                  <form action={acceptConversationRequest}>
                    <input type="hidden" name="thread_id" value={thread.id} />
                    <button
                      type="submit"
                      className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      Godta
                    </button>
                  </form>
                  <form action={declineConversationRequest}>
                    <input type="hidden" name="thread_id" value={thread.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Avslå
                    </button>
                  </form>
                </div>
              ) : (
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  Venter på at brukeren godtar.
                </p>
              )
            ) : thread.status === "declined" ? (
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                Meldingsforespørselen ble avslått.
              </p>
            ) : thread.status === "blocked" ? (
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                Denne chatten er blokkert.
              </p>
            ) : (
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                Samtale med {otherName}
              </p>
            )}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {(messageRows ?? []).length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Ingen meldinger ennå.
              </p>
            ) : (
              (messageRows ?? []).map((message) => {
                const isOwn = message.sender_id === user.id;
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        isOwn
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                          : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.body}</p>
                      <p
                        className={`mt-1 text-[11px] ${
                          isOwn ? "text-zinc-300 dark:text-zinc-500" : "text-zinc-500 dark:text-zinc-400"
                        }`}
                      >
                        {message.created_at
                          ? new Date(message.created_at).toLocaleString("nb-NO")
                          : "—"}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="sticky bottom-0 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
            {canSend ? (
              <ThreadMessageForm threadId={thread.id} />
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Du kan ikke sende meldinger i denne chatten akkurat nå.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
