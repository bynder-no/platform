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

import { MessageReplyForm } from "./message-reply-form";

export const dynamic = "force-dynamic";

type MessageRow = {
  id: string;
  body: string;
  created_at: string | null;
  listing_id: string;
  sender_id: string;
  recipient_id: string;
};

function threadKey(m: MessageRow) {
  const [a, b] = [m.sender_id, m.recipient_id].sort();
  return `${m.listing_id}|${a}|${b}`;
}

function profileLabel(
  p:
    | { display_name: string | null; username: string | null }
    | undefined
    | null,
) {
  if (!p) return "Member";
  return p.display_name?.trim() || p.username?.trim() || "Member";
}

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: messageRows, error: messagesError } = await supabase
    .from("messages")
    .select("id, body, created_at, listing_id, sender_id, recipient_id")
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (messagesError) {
    throw new Error(`Could not load messages: ${messagesError.message}`);
  }

  const messages = (messageRows ?? []) as MessageRow[];

  const groupMap = new Map<string, MessageRow[]>();
  for (const m of messages) {
    const key = threadKey(m);
    const list = groupMap.get(key);
    if (list) {
      list.push(m);
    } else {
      groupMap.set(key, [m]);
    }
  }

  const threads = [...groupMap.entries()].map(([key, msgs]) => {
    const sorted = [...msgs].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (ta !== tb) return ta - tb;
      return a.id.localeCompare(b.id);
    });
    const last = sorted[sorted.length - 1];
    const lastAt = last?.created_at
      ? new Date(last.created_at).getTime()
      : 0;
    return { key, messages: sorted, lastAt };
  });

  threads.sort((a, b) => b.lastAt - a.lastAt);

  const listingIds = [...new Set(messages.map((m) => m.listing_id))];
  const profileIds = [
    ...new Set(
      messages.flatMap((m) => [m.sender_id, m.recipient_id]),
    ),
  ];

  const listingById = new Map<string, { id: string; title: string | null }>();
  if (listingIds.length > 0) {
    const { data: listings, error: listingsError } = await supabase
      .from("listings")
      .select("id, title")
      .in("id", listingIds);

    if (listingsError) {
      throw new Error(`Could not load listings: ${listingsError.message}`);
    }

    for (const row of listings ?? []) {
      listingById.set(row.id, row);
    }
  }

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

  return (
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <h1 className={pageTitleClass}>Messages</h1>
        <SignedInNavLinks />
      </header>

      <section className={pageBodyGapClass}>
        {messages.length === 0 ? (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            <p className="font-medium text-zinc-800 dark:text-zinc-200">
              No messages yet
            </p>
            <p className="mt-2">
              When someone contacts you about a listing, or you contact a
              seller, messages appear here.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-10 text-sm">
            {threads.map(({ key, messages: threadMessages }) => {
              const first = threadMessages[0];
              const latest = threadMessages[threadMessages.length - 1];
              const listing = listingById.get(first.listing_id);
              const listingTitle = listing?.title?.trim() || "Listing";
              const otherId =
                first.sender_id === user.id
                  ? first.recipient_id
                  : first.sender_id;
              const otherProfile = profileById.get(otherId);
              const otherName = profileLabel(otherProfile);

              return (
                <li key={key} className="space-y-3">
                  <div className="space-y-1">
                    <p>
                      <Link
                        href={`/listings/${first.listing_id}`}
                        className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                      >
                        {listingTitle}
                      </Link>
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      With {otherName}
                    </p>
                  </div>
                  <ul className="space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                    {threadMessages.map((msg) => {
                      const sender = profileById.get(msg.sender_id);
                      const senderName = profileLabel(sender);
                      const isOutgoing = msg.sender_id === user.id;
                      const speaker = isOutgoing ? "You" : senderName;
                      const when = msg.created_at
                        ? new Date(msg.created_at).toLocaleString()
                        : "—";

                      return (
                        <li key={msg.id} className="space-y-1">
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {speaker}
                            <span className="text-zinc-300 dark:text-zinc-600">
                              {" "}
                              ·{" "}
                            </span>
                            {when}
                          </p>
                          <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                            {msg.body}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="border-t border-zinc-200 pt-3 dark:border-zinc-700">
                    <MessageReplyForm parentMessageId={latest.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
