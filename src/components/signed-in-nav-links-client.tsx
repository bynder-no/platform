"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  CHAT_PANEL_STATE_EVENT,
  MESSAGES_INBOX_PANEL_OPEN_EVENT,
  NOTIFICATIONS_NAV_HREF,
  NOTIFICATIONS_PANEL_STATE_EVENT,
  OPEN_CHAT_PANEL_EVENT,
  OPEN_NOTIFICATIONS_PANEL_EVENT,
} from "@/lib/chat-panel-events";

/** Outline stroke aligned with home category shortcuts (~20px, stroke 1.8). */
const navIconClass =
  "h-5 w-5 shrink-0 text-current";

function IconBell() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className={navIconClass}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

function IconChatBubble() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className={navIconClass}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

const navIconButtonClass =
  "relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 active:scale-[0.98]";

function navIconAccentClass(active: boolean) {
  return active
    ? "bg-blue-50 text-blue-800 ring-1 ring-blue-200/90"
    : "";
}

const navIconBadgeClass =
  "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-0.5 text-[9px] font-bold leading-none text-white shadow-sm";

type NavLinkItem = {
  href: string;
  label: string;
};

type SignedInNavLinksClientProps = {
  groups: NavLinkItem[][];
  messagesBadgeCount: number;
  varslerBadgeCount: number;
  children?: ReactNode;
};

function hrefMatchesPathname(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function activeHrefForPath(links: NavLinkItem[], pathname: string): string | null {
  const matches = links.filter((item) => hrefMatchesPathname(item.href, pathname));
  if (matches.length === 0) return null;
  matches.sort((a, b) => b.href.length - a.href.length);
  return matches[0]?.href ?? null;
}

export function SignedInNavLinksClient({
  groups,
  messagesBadgeCount,
  varslerBadgeCount,
  children,
}: SignedInNavLinksClientProps) {
  const pathname = usePathname();
  const flatLinks = useMemo(() => groups.flat(), [groups]);
  const activeHref = activeHrefForPath(flatLinks, pathname);
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);
  const [isNotificationsPanelOpen, setIsNotificationsPanelOpen] = useState(false);

  /** Snapshot taken when Chatter inbox opens; badge hidden until count rises above this. */
  const [dismissedBadgeSnapshot, setDismissedBadgeSnapshot] = useState(0);

  /** Varsler badge baseline while panel or fallback page is open — no DB writes. */
  const [varslerDismissBaseline, setVarslerDismissBaseline] = useState(0);

  useEffect(() => {
    const onPanelState = (event: Event) => {
      const customEvent = event as CustomEvent<{ open?: boolean }>;
      setIsChatPanelOpen(Boolean(customEvent.detail?.open));
    };
    window.addEventListener(CHAT_PANEL_STATE_EVENT, onPanelState as EventListener);
    return () =>
      window.removeEventListener(CHAT_PANEL_STATE_EVENT, onPanelState as EventListener);
  }, []);

  useEffect(() => {
    const onNotesState = (event: Event) => {
      const customEvent = event as CustomEvent<{ open?: boolean }>;
      setIsNotificationsPanelOpen(Boolean(customEvent.detail?.open));
    };
    window.addEventListener(NOTIFICATIONS_PANEL_STATE_EVENT, onNotesState as EventListener);
    return () =>
      window.removeEventListener(NOTIFICATIONS_PANEL_STATE_EVENT, onNotesState as EventListener);
  }, []);

  useEffect(() => {
    const onInboxPanelOpen = () => {
      setDismissedBadgeSnapshot(messagesBadgeCount);
    };
    window.addEventListener(MESSAGES_INBOX_PANEL_OPEN_EVENT, onInboxPanelOpen);
    return () =>
      window.removeEventListener(MESSAGES_INBOX_PANEL_OPEN_EVENT, onInboxPanelOpen);
  }, [messagesBadgeCount]);

  /* Hide Varsler badge while dropdown or /notifications fallback is “open”. */
  useEffect(() => {
    if (!pathname.startsWith("/notifications") && !isNotificationsPanelOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- visibility-only baseline sync with server unread count.
    setVarslerDismissBaseline(varslerBadgeCount);
  }, [pathname, varslerBadgeCount, isNotificationsPanelOpen]);

  const showVarslerNavBadge =
    !pathname.startsWith("/notifications") &&
    !isNotificationsPanelOpen &&
    varslerBadgeCount > varslerDismissBaseline;

  const showMessagesNavBadge = messagesBadgeCount > dismissedBadgeSnapshot;

  function renderItem(item: NavLinkItem) {
    const isMessagesLink = item.href === "#chatter";
    const isVarslerLink = item.href === NOTIFICATIONS_NAV_HREF;
    const isActive = isMessagesLink
      ? isChatPanelOpen
      : isVarslerLink
        ? isNotificationsPanelOpen
        : activeHref === item.href;

    if (isMessagesLink) {
      return (
        <button
          key={item.href}
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent(OPEN_CHAT_PANEL_EVENT));
          }}
          className={[navIconButtonClass, navIconAccentClass(isActive)]
            .filter(Boolean)
            .join(" ")}
          aria-label={
            showMessagesNavBadge
              ? `Meldinger, ${messagesBadgeCount} uleste`
              : "Meldinger"
          }
        >
          <IconChatBubble />
          {showMessagesNavBadge ? (
            <span className={navIconBadgeClass} aria-hidden>
              {messagesBadgeCount > 99 ? "99+" : messagesBadgeCount}
            </span>
          ) : null}
        </button>
      );
    }

    if (isVarslerLink) {
      return (
        <button
          key={item.href}
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent(OPEN_NOTIFICATIONS_PANEL_EVENT));
          }}
          className={[navIconButtonClass, navIconAccentClass(isActive)]
            .filter(Boolean)
            .join(" ")}
          aria-label={
            showVarslerNavBadge
              ? `Varsler, ${varslerBadgeCount} uleste`
              : "Varsler"
          }
        >
          <IconBell />
          {showVarslerNavBadge ? (
            <span className={navIconBadgeClass} aria-hidden>
              {varslerBadgeCount > 99 ? "99+" : varslerBadgeCount}
            </span>
          ) : null}
        </button>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={[
          "ui-nav-chip",
          isActive ? "ui-nav-chip-accent" : null,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <>
      {groups.map((group, groupIndex) => (
        <div
          key={`nav-group-${groupIndex}`}
          className={
            groupIndex === groups.length - 1
              ? "flex flex-wrap items-center gap-3"
              : "flex flex-wrap items-center gap-2"
          }
        >
          {group.map((item) => renderItem(item))}
          {groupIndex === groups.length - 1 ? children : null}
        </div>
      ))}
    </>
  );
}
