/** Compact Norwegian-relative labels for Chatter inbox rows (local timezone). */

const WEEKDAY_SHORT_NB = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole calendar days from message date to reference (reference >= message typically). */
function calendarDaysBetween(message: Date, reference: Date): number {
  const a = startOfLocalDay(message).getTime();
  const b = startOfLocalDay(reference).getTime();
  return Math.round((b - a) / 86400000);
}

function formatTimeNb(d: Date): string {
  return new Intl.DateTimeFormat("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function formatDayMonthNb(d: Date): string {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
  }).format(d);
}

function formatDayMonthYearNb(d: Date): string {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/**
 * Formats an ISO-ish timestamp for Chatter list rows.
 * today → 12:21 · yesterday → I går · last week → Man … · same year → 4. mai · else → 4. mai 2025
 */
export function formatChatterListTime(
  iso: string | null | undefined,
  reference = new Date(),
): string {
  const raw = iso != null ? String(iso).trim() : "";
  if (raw === "") return "—";

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";

  const dayDiff = calendarDaysBetween(d, reference);

  if (dayDiff < 0) {
    return formatTimeNb(d);
  }

  if (dayDiff === 0) {
    return formatTimeNb(d);
  }

  if (dayDiff === 1) {
    return "I går";
  }

  if (dayDiff >= 2 && dayDiff <= 7) {
    return WEEKDAY_SHORT_NB[d.getDay()] ?? "—";
  }

  if (d.getFullYear() === reference.getFullYear()) {
    return formatDayMonthNb(d);
  }

  return formatDayMonthYearNb(d);
}

/**
 * Timestamp inside message bubbles: today → 13:55 · yesterday → I går 13:55 · same year → 4. mai 13:55 · else → 4. mai 2025 13:55
 */
export function formatMessageBubbleTime(
  iso: string | null | undefined,
  reference = new Date(),
): string {
  const raw = iso != null ? String(iso).trim() : "";
  if (raw === "") return "—";

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";

  const clock = formatTimeNb(d);
  const dayDiff = calendarDaysBetween(d, reference);

  if (dayDiff < 0) {
    return clock;
  }

  if (dayDiff === 0) {
    return clock;
  }

  if (dayDiff === 1) {
    return `I går ${clock}`;
  }

  if (d.getFullYear() === reference.getFullYear()) {
    return `${formatDayMonthNb(d)} ${clock}`;
  }

  return `${formatDayMonthYearNb(d)} ${clock}`;
}
