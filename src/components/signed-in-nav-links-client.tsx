"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLinkItem = {
  href: string;
  label: string;
};

type SignedInNavLinksClientProps = {
  links: NavLinkItem[];
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

export function SignedInNavLinksClient({ links }: SignedInNavLinksClientProps) {
  const pathname = usePathname();
  const activeHref = activeHrefForPath(links, pathname);

  return (
    <>
      {links.map((item) => {
        const isActive = activeHref === item.href;
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
