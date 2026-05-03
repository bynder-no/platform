"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { markNotificationRead } from "./actions";

type NotificationRowLinkProps = {
  notificationId: string;
  href: string;
  isUnread: boolean;
  className?: string;
  children: ReactNode;
  /** Runs after navigation is initiated (e.g. close dropdown). */
  onAfterNavigate?: () => void;
};

export function NotificationRowLink({
  notificationId,
  href,
  isUnread,
  className,
  children,
  onAfterNavigate,
}: NotificationRowLinkProps) {
  const router = useRouter();

  async function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
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
