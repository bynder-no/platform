"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { markNotificationRead } from "./actions";
import { OPEN_CHAT_PANEL_EVENT, OPEN_CHAT_THREAD_EVENT } from "@/lib/chat-panel-events";

type NotificationRowLinkProps = {
  notificationId: string;
  href: string;
  isUnread: boolean;
  className?: string;
  children: ReactNode;
  openThreadId?: string | null;
  /** Runs after navigation is initiated (e.g. close dropdown). */
  onAfterNavigate?: () => void;
};

export function NotificationRowLink({
  notificationId,
  href,
  isUnread,
  className,
  children,
  openThreadId,
  onAfterNavigate,
}: NotificationRowLinkProps) {
  const router = useRouter();

  async function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const threadId = String(openThreadId ?? "").trim();
    const shouldOpenThread = threadId !== "";
    if (shouldOpenThread) {
      e.preventDefault();
      if (isUnread) {
        await markNotificationRead(notificationId);
        router.refresh();
      }
      onAfterNavigate?.();
      window.dispatchEvent(new CustomEvent(OPEN_CHAT_PANEL_EVENT));
      window.dispatchEvent(
        new CustomEvent(OPEN_CHAT_THREAD_EVENT, {
          detail: { threadId },
        }),
      );
      return;
    }
    if (!isUnread) {
      onAfterNavigate?.();
      return;
    }
    e.preventDefault();
    await markNotificationRead(notificationId);
    router.refresh();
    onAfterNavigate?.();
    router.push(href);
  }

  return (
    <Link href={href} onClick={handleClick} className={className}>
      {children}
    </Link>
  );
}
