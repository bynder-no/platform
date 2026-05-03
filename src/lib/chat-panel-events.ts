export const OPEN_CHAT_PANEL_EVENT = "bynder:chat-panel-open";
export const CHAT_PANEL_STATE_EVENT = "bynder:chat-panel-state";
/** Chatter list panel (Alle / Uleste / Forespørsler) became visible. */
export const MESSAGES_INBOX_PANEL_OPEN_EVENT = "bynder:messages-inbox-panel-open";
/** Open a specific thread in the floating bubble (deep link / profile actions). */
export const OPEN_CHAT_THREAD_EVENT = "bynder:open-chat-thread";

/** Nav icon / keyboard: open Varsler dropdown (same layer as chatter). */
export const OPEN_NOTIFICATIONS_PANEL_EVENT = "bynder:notifications-panel-open";
/** Floating Varsler panel visibility — drives nav bell active state + badge baseline. */
export const NOTIFICATIONS_PANEL_STATE_EVENT = "bynder:notifications-panel-state";

/** Hash href for Varsler in nav data (no route navigation). */
export const NOTIFICATIONS_NAV_HREF = "#notifications-panel";
