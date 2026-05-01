import { redirect } from "next/navigation";

import { MessagesInboxView } from "@/app/messages/messages-inbox-view";
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

function formatWhen(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
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

  const inboxItems = inbox.map((thread) => {
    const otherId =
      thread.requester_id === user.id ? thread.recipient_id : thread.requester_id;
    const other = profileById.get(otherId);
    const last = lastMessageByThreadId.get(thread.id);
    const when = last?.created_at ?? thread.updated_at;
    const waitingForApproval =
      thread.status === "pending" && thread.requester_id === user.id;
    return {
      id: thread.id,
      otherName: profileLabel(other),
      preview: waitingForApproval ? "Venter på godkjenning" : previewText(last?.body),
      when: formatWhen(when),
      isPendingRequest: waitingForApproval,
      hasUnread: false,
    };
  });

  const requestItems = requests.map((thread) => {
    const other = profileById.get(thread.requester_id);
    const last = lastMessageByThreadId.get(thread.id);
    return {
      id: thread.id,
      otherName: profileLabel(other),
      preview: previewText(last?.body),
      when: formatWhen(last?.created_at ?? thread.updated_at),
      isPendingRequest: true,
      hasUnread: true,
    };
  });

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <h1 className={pageTitleClass}>Meldinger</h1>
      </header>

      <section className={pageBodyGapClass}>
        {threads.length === 0 ? (
          <div className="text-sm text-zinc-600">
            <p className="font-medium text-zinc-800">
              Ingen meldinger ennå
            </p>
            <p className="mt-2">
              Start en chat fra en offentlig profil med knappen &quot;Send melding&quot;.
            </p>
          </div>
        ) : (
          <MessagesInboxView inboxItems={inboxItems} requestItems={requestItems} />
        )}
      </section>
      </div>
    </div>
  );
}
