const MS_DAY = 86_400_000;
const MS_HOUR = 3_600_000;
const MS_MIN = 60_000;
const MS_10_MIN = 10 * MS_MIN;

/**
 * Compact remaining time until `endMs` (server snapshot).
 * Same rules as dashboard «Auksjoner du følger» cards.
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
