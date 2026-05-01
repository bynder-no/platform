"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavLinkItem = {
  href: string;
  label: string;
};

type SignedInNavLinksClientProps = {
  links: NavLinkItem[];
};

const OPEN_CHAT_PANEL_EVENT = "bynder:chat-panel-open";
const CHAT_PANEL_STATE_EVENT = "bynder:chat-panel-state";

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

export function SignedInNavLinksClient({ links }: SignedInNavLinksClientProps) {
  const pathname = usePathname();
  const activeHref = activeHrefForPath(links, pathname);
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);

  useEffect(() => {
    const onPanelState = (event: Event) => {
      const customEvent = event as CustomEvent<{ open?: boolean }>;
      setIsChatPanelOpen(Boolean(customEvent.detail?.open));
    };
    window.addEventListener(CHAT_PANEL_STATE_EVENT, onPanelState as EventListener);
    return () =>
      window.removeEventListener(CHAT_PANEL_STATE_EVENT, onPanelState as EventListener);
  }, []);

  return (
    <>
      {links.map((item) => {
        const isMessagesLink = item.href === "/messages";
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
                "ui-nav-chip",
                isActive ? "ui-nav-chip-accent" : null,
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label="Åpne meldingspanel"
            >
              {item.label}
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
      })}
    </>
  );
}
