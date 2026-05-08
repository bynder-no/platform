"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { NotificationRowLink } from "@/app/notifications/notification-row-link";
import {
  CLOSE_MESSAGES_INBOX_PANEL_EVENT,
  CLOSE_NOTIFICATIONS_PANEL_EVENT,
  NOTIFICATIONS_PANEL_STATE_EVENT,
  OPEN_NOTIFICATIONS_PANEL_EVENT,
} from "@/lib/chat-panel-events";
import {
  categoryForType,
  categoryIcon,
  destinationHref,
  destinationLabel,
  formatNotificationWhen,
  listingHrefForContext,
  titleForType,
  type NotificationRow,
} from "@/lib/notification-display";

type FloatingNotificationsPanelProps = {
  initialNotifications: NotificationRow[];
  listingTitleById: Record<string, string>;
};

function tabClass(active: boolean) {
  if (active) {
    return "rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white";
  }
  return "rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100";
}

export function FloatingNotificationsPanel({
  initialNotifications,
  listingTitleById,
}: FloatingNotificationsPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [rows, setRows] = useState<NotificationRow[]>(initialNotifications);

  useEffect(() => {
    setRows(initialNotifications);
  }, [initialNotifications]);

  useEffect(() => {
    const handler = () => {
      window.dispatchEvent(new CustomEvent(CLOSE_MESSAGES_INBOX_PANEL_EVENT));
      setOpen(true);
      router.refresh();
    };
    const handleClose = () => {
      setOpen(false);
    };
    window.addEventListener(OPEN_NOTIFICATIONS_PANEL_EVENT, handler);
    window.addEventListener(CLOSE_NOTIFICATIONS_PANEL_EVENT, handleClose);
    return () => {
      window.removeEventListener(OPEN_NOTIFICATIONS_PANEL_EVENT, handler);
      window.removeEventListener(CLOSE_NOTIFICATIONS_PANEL_EVENT, handleClose);
    };
  }, [router]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(NOTIFICATIONS_PANEL_STATE_EVENT, {
        detail: { open },
      }),
    );
  }, [open]);

  const visibleRows = useMemo(() => {
    if (tab === "unread") {
      return rows.filter((r) => !r.is_read);
    }
    return rows;
  }, [rows, tab]);

  const unreadCount = useMemo(
    () => rows.filter((r) => !r.is_read).length,
    [rows],
  );

  const closePanel = useCallback(() => setOpen(false), []);

  return (
    <>
      {open ? (
        <div
          className="fixed right-5 top-20 z-40 flex max-h-[min(560px,calc(100vh-5rem))] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg"
          role="dialog"
          aria-modal="true"
          aria-labelledby="notifications-panel-title"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3">
            <h2
              id="notifications-panel-title"
              className="text-base font-semibold text-zinc-900"
            >
              Varsler
            </h2>
            <button
              type="button"
              onClick={closePanel}
              className="rounded-md px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
              aria-label="Lukk varsler"
            >
              Lukk
            </button>
          </div>

          <div className="shrink-0 border-b border-zinc-200 px-4 py-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={tabClass(tab === "all")}
                onClick={() => setTab("all")}
              >
                Alle ({rows.length})
              </button>
              <button
                type="button"
                className={tabClass(tab === "unread")}
                onClick={() => setTab("unread")}
              >
                Uleste ({unreadCount})
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {visibleRows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-zinc-600">Ingen varsler ennå.</p>
            ) : (
              <ul className="divide-y divide-zinc-200">
                {visibleRows.map((n) => {
                  const category = categoryForType(n.type);
                  const title = titleForType(n.type);
                  const message = String(n.message ?? "").trim() || "Varsel";
                  const destination = destinationHref(n);
                  const destinationText = destinationLabel(n);
                  const icon = categoryIcon(category);
                  const contextListingHref = listingHrefForContext(n);
                  const listingLabel = n.listing_id
                    ? listingTitleById[n.listing_id] ?? "Annonse"
                    : null;
                  return (
                    <li key={n.id}>
                      <NotificationRowLink
                        notificationId={n.id}
                        href={destination}
                        openThreadId={n.resolved_thread_id ?? n.thread_id}
                        isUnread={!n.is_read}
                        onAfterNavigate={closePanel}
                        className={`flex items-start gap-3 px-3 py-3 hover:bg-zinc-50 ${
                          n.is_read ? "" : "bg-blue-50/60"
                        }`}
                      >
                        <div className="relative mt-0.5 h-11 w-11 shrink-0 rounded-full bg-zinc-200">
                          <span className="flex h-full w-full items-center justify-center text-base">
                            👤
                          </span>
                          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-blue-600 text-[10px] text-white">
                            {icon}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-zinc-900">
                            {title}
                          </p>
                          <p className="mt-0.5 text-sm text-zinc-700">{message}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">
                              {category}
                            </span>
                            {contextListingHref && listingLabel ? (
                              <span className="text-zinc-600">{listingLabel}</span>
                            ) : null}
                            <span className="text-zinc-500">
                              {formatNotificationWhen(n.created_at)}
                            </span>
                            <span className="font-medium text-zinc-700">
                              {destinationText}
                            </span>
                          </div>
                        </div>

                        {!n.is_read ? (
                          <span
                            className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600"
                            aria-label="Ulest"
                            title="Ulest"
                          />
                        ) : null}
                      </NotificationRowLink>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
