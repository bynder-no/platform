/**
 * Public-facing user label: prefer `username`, then legacy `display_name`.
 */
export function userPublicLabel(
  username: string | null | undefined,
  displayName: string | null | undefined,
  fallback = "—",
): string {
  const u = String(username ?? "").trim();
  if (u !== "") return u;
  const d = String(displayName ?? "").trim();
  if (d !== "") return d;
  return fallback;
}
