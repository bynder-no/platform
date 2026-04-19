/**
 * Anti-snipe: if remaining time is strictly less than this when a bid is accepted,
 * `auction_ends_at` is set to (bid time + this many ms). If remaining is this long or more, end time is unchanged.
 */
export const ANTI_SNIPE_WINDOW_MS = 5 * 60 * 1000;
