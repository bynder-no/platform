"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { OPEN_CHAT_THREAD_EVENT } from "@/lib/chat-panel-events";

/**
 * Opens Chatter for `/?chatThread=<uuid>` then strips the query (fallback deep links only).
 */
function ChatThreadDeepLinkInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const threadId = searchParams.get("chatThread")?.trim();
    if (!threadId) return;

    window.dispatchEvent(
      new CustomEvent(OPEN_CHAT_THREAD_EVENT, {
        detail: { threadId },
      }),
    );
    router.replace("/", { scroll: false });
  }, [searchParams, router]);

  return null;
}

export function ChatThreadDeepLink() {
  return (
    <Suspense fallback={null}>
      <ChatThreadDeepLinkInner />
    </Suspense>
  );
}
