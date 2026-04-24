export const LISTING_TYPE_VALUES = ["auction", "fixed_price"] as const;

export type ListingTypeChoice = (typeof LISTING_TYPE_VALUES)[number];

const TYPE_SET = new Set<string>(LISTING_TYPE_VALUES);

export function parseListingType(
  raw: string | string[] | null | undefined,
): ListingTypeChoice | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = String(s ?? "").trim();
  return TYPE_SET.has(trimmed) ? (trimmed as ListingTypeChoice) : null;
}
