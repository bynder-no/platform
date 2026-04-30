import Link from "next/link";
import { redirect } from "next/navigation";

import { SignedInNavLinks } from "@/components/signed-in-nav-links";
import { createClient } from "@/lib/supabase/server";
import {
  pageBodyGapClass,
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";

export const dynamic = "force-dynamic";

type ThreadRow = {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: string;
  updated_at: string | null;
};

type ConversationMessageRow = {
  id: string;
  thread_id: string;
  body: string;
  created_at: string | null;
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

function previewText(body: string | null | undefined) {
  const text = String(body ?? "").trim();
  if (!text) return "Ingen meldinger ennå";
  if (text.length <= 64) return text;
  return `${text.slice(0, 64)}...`;
}

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: threadRows, error: threadsError } = await supabase
    .from("conversation_threads")
    .select("id, requester_id, recipient_id, status, updated_at")
    .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order("updated_at", { ascending: false });

  if (threadsError) {
    throw new Error(`Could not load conversation threads: ${threadsError.message}`);
  }

  const threads = (threadRows ?? []) as ThreadRow[];
  const threadIds = threads.map((row) => row.id);
  const profileIds = [
    ...new Set(
      threads.flatMap((t) => [t.requester_id, t.recipient_id]),
    ),
  ];

  const profileById = new Map<
    string,
    { id: string; display_name: string | null; username: string | null }
  >();
  if (profileIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name, username")
      .in("id", profileIds);

    if (profilesError) {
      throw new Error(`Could not load profiles: ${profilesError.message}`);
    }

    for (const row of profiles ?? []) {
      profileById.set(row.id, row);
    }
  }

  const lastMessageByThreadId = new Map<
    string,
    { body: string; created_at: string | null }
  >();
  if (threadIds.length > 0) {
    const { data: messagesData, error: messagesError } = await supabase
      .from("conversation_messages")
      .select("id, thread_id, body, created_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false });

    if (messagesError) {
      throw new Error(`Could not load conversation messages: ${messagesError.message}`);
    }

    for (const message of (messagesData ?? []) as ConversationMessageRow[]) {
      if (!lastMessageByThreadId.has(message.thread_id)) {
        lastMessageByThreadId.set(message.thread_id, {
          body: message.body,
          created_at: message.created_at,
        });
      }
    }
  }

  const requests = threads.filter(
    (thread) => thread.status === "pending" && thread.recipient_id === user.id,
  );
  const inbox = threads.filter((thread) => {
    if (thread.status === "accepted") return true;
    if (thread.status === "pending" && thread.requester_id === user.id) return true;
    return false;
  });

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <h1 className={pageTitleClass}>Meldinger</h1>
        <SignedInNavLinks />
      </header>

      <section className={pageBodyGapClass}>
        {threads.length === 0 ? (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            <p className="font-medium text-zinc-800 dark:text-zinc-200">
              Ingen meldinger ennå
            </p>
            <p className="mt-2">
              Start en chat fra en offentlig profil med knappen &quot;Send melding&quot;.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Innboks
              </h2>
              {inbox.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Ingen aktive samtaler.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-700">
                  {inbox.map((thread) => {
                    const otherId =
                      thread.requester_id === user.id
                        ? thread.recipient_id
                        : thread.requester_id;
                    const other = profileById.get(otherId);
                    const otherName = profileLabel(other);
                    const last = lastMessageByThreadId.get(thread.id);
                    const preview = previewText(last?.body);
                    const when = last?.created_at ?? thread.updated_at;
                    return (
                      <li key={thread.id} className="py-2">
                        <Link
                          href={`/messages/${thread.id}`}
                          className="block rounded-md px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {otherName}
                          </p>
                          <p className="text-xs text-zinc-600 dark:text-zinc-400">
                            {thread.status === "pending" && thread.requester_id === user.id
                              ? "Venter på godkjenning"
                              : preview}
                          </p>
                          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                            {when ? new Date(when).toLocaleString("nb-NO") : "—"}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Forespørsler
              </h2>
              {requests.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Ingen nye forespørsler.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-700">
                  {requests.map((thread) => {
                    const other = profileById.get(thread.requester_id);
                    const otherName = profileLabel(other);
                    const last = lastMessageByThreadId.get(thread.id);
                    return (
                      <li key={thread.id} className="py-2">
                        <Link
                          href={`/messages/${thread.id}`}
                          className="block rounded-md px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {otherName}
                          </p>
                          <p className="text-xs text-zinc-600 dark:text-zinc-400">
                            {previewText(last?.body)}
                          </p>
                          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                            {thread.updated_at
                              ? new Date(thread.updated_at).toLocaleString("nb-NO")
                              : "—"}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
