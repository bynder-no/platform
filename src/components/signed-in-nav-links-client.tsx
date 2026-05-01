"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  CHAT_PANEL_STATE_EVENT,
  MESSAGES_INBOX_PANEL_OPEN_EVENT,
  OPEN_CHAT_PANEL_EVENT,
} from "@/lib/chat-panel-events";

type NavLinkItem = {
  href: string;
  label: string;
};

type SignedInNavLinksClientProps = {
  links: NavLinkItem[];
  messagesBadgeCount: number;
  varslerBadgeCount: number;
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
  links,
  messagesBadgeCount,
  varslerBadgeCount,
}: SignedInNavLinksClientProps) {
  const pathname = usePathname();
  const activeHref = activeHrefForPath(links, pathname);
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);

  /** Snapshot taken when Chatter inbox opens; badge hidden until count rises above this. */
  const [dismissedBadgeSnapshot, setDismissedBadgeSnapshot] = useState(0);

  /**
   * Baseline for Messages-style Varsler badge hiding: updated only while the user is on
   * /notifications so the nav chip can hide without DB writes. Unread dots on /notifications
   * still come from the server only.
   */
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
    const onInboxPanelOpen = () => {
      setDismissedBadgeSnapshot(messagesBadgeCount);
    };
    window.addEventListener(MESSAGES_INBOX_PANEL_OPEN_EVENT, onInboxPanelOpen);
    return () =>
      window.removeEventListener(MESSAGES_INBOX_PANEL_OPEN_EVENT, onInboxPanelOpen);
  }, [messagesBadgeCount]);

  /* Sync baseline from DB count while on Varsler route — not a cache of “read” state. */
  useEffect(() => {
    if (!pathname.startsWith("/notifications")) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- baseline tracks server unread count while /notifications is open; visibility-only, no DB writes.
    setVarslerDismissBaseline(varslerBadgeCount);
  }, [pathname, varslerBadgeCount]);

  const showVarslerNavBadge =
    pathname.startsWith("/notifications")
      ? false
      : varslerBadgeCount > varslerDismissBaseline;

  const showMessagesNavBadge = messagesBadgeCount > dismissedBadgeSnapshot;

  return (
    <>
      {links.map((item) => {
        const isMessagesLink = item.href === "#chatter";
        const isActive =
          isMessagesLink ? isChatPanelOpen : activeHref === item.href;

        if (isMessagesLink) {
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent(OPEN_CHAT_PANEL_EVENT));
              }}
              className={[
                "ui-nav-chip relative",
                isActive ? "ui-nav-chip-accent" : null,
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label="Åpne meldingspanel"
            >
              {item.label}
              {showMessagesNavBadge ? (
                <span
                  className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold leading-none text-white"
                  aria-label={`${messagesBadgeCount} nye i meldinger`}
                >
                  {messagesBadgeCount > 99 ? "99+" : messagesBadgeCount}
                </span>
              ) : null}
            </button>
          );
        }

        const isVarslerLink = item.href === "/notifications";

        if (isVarslerLink) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "ui-nav-chip relative",
                isActive ? "ui-nav-chip-accent" : null,
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={
                showVarslerNavBadge
                  ? `Varsler, ${varslerBadgeCount} uleste`
                  : "Varsler"
              }
            >
              {item.label}
              {showVarslerNavBadge ? (
                <span
                  className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold leading-none text-white"
                  aria-hidden
                >
                  {varslerBadgeCount > 99 ? "99+" : varslerBadgeCount}
                </span>
              ) : null}
            </Link>
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
      })}
    </>
  );
}
