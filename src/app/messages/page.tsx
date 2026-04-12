import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

  const messages = messageRows ?? [];

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
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-16">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Messages
        </h1>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
        >
          Dashboard
        </Link>
      </div>

      <section className="mt-10">
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
          <ul className="mt-4 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
            {messages.map((msg) => {
              const listing = listingById.get(msg.listing_id);
              const listingTitle = listing?.title?.trim() || "Listing";
              const sender = profileById.get(msg.sender_id);
              const recipient = profileById.get(msg.recipient_id);
              const senderName = profileLabel(sender);
              const recipientName = profileLabel(recipient);
              const isOutgoing = msg.sender_id === user.id;
              const contextLine = isOutgoing
                ? `You → ${recipientName}`
                : `${senderName} → you`;

              return (
                <li
                  key={msg.id}
                  className="flex flex-col gap-2 px-3 py-4 text-sm"
                >
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {contextLine}
                  </p>
                  <p>
                    <span className="text-zinc-500 dark:text-zinc-400">
                      Listing:{" "}
                    </span>
                    <Link
                      href={`/listings/${msg.listing_id}`}
                      className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                    >
                      {listingTitle}
                    </Link>
                  </p>
                  <p className="whitespace-pre-wrap leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {msg.body}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {msg.created_at
                      ? new Date(msg.created_at).toLocaleString()
                      : "—"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
