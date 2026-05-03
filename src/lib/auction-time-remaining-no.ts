const MS_DAY = 86_400_000;
const MS_HOUR = 3_600_000;
const MS_MIN = 60_000;
const MS_10_MIN = 10 * MS_MIN;

/**
 * Compact remaining time until `endMs` from `nowMs` (server snapshot).
 * Home auction cards and dashboard «Auksjoner du følger»: day/hour when >1d, then hour/minute, minutes, m+s, or seconds only.
 */
export function formatAuctionTimeRemainingNo(
  endMs: number,
  nowMs: number,
): string {
  const ms = endMs - nowMs;
  if (ms <= 0) return "Avsluttet";

  if (ms > MS_DAY) {
    const days = Math.floor(ms / MS_DAY);
    const rem = ms % MS_DAY;
    const hours = Math.floor(rem / MS_HOUR);
    return hours > 0 ? `${days}d ${hours}t igjen` : `${days}d igjen`;
  }

  if (ms > MS_HOUR) {
    const hours = Math.floor(ms / MS_HOUR);
    const mins = Math.floor((ms % MS_HOUR) / MS_MIN);
    return mins > 0 ? `${hours}t ${mins}m igjen` : `${hours}t igjen`;
  }

  if (ms > MS_10_MIN) {
    const mins = Math.floor(ms / MS_MIN);
    return `${mins}m igjen`;
  }

  if (ms >= MS_MIN) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}m ${s}s igjen`;
  }

  const secs = Math.floor(ms / 1000);
  return `${secs}s igjen`;
}

/**
 * Same rules as home/search auction cards: live → time until end; planlagt → until start;
 * avsluttet → null (caller may show ended copy separately).
 */
export function auctionTimeRemainingLabelFromState(
  state: "Planlagt" | "Live" | "Avsluttet",
  startsAt: string | null,
  endsAt: string | null,
  nowMs: number,
): string | null {
  if (state === "Live") {
    const endMs = endsAt ? new Date(endsAt).getTime() : Number.NaN;
    if (!Number.isFinite(endMs)) return null;
    return formatAuctionTimeRemainingNo(endMs, nowMs);
  }
  if (state === "Planlagt") {
    const startMs = startsAt ? new Date(startsAt).getTime() : Number.NaN;
    if (!Number.isFinite(startMs)) return null;
    return formatAuctionTimeRemainingNo(startMs, nowMs);
  }
  return null;
}
