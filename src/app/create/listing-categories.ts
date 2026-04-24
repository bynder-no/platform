export const LISTING_CATEGORY_OPTIONS = [
  { slug: "single_card", label: "Singelkort" },
  { slug: "slab", label: "PSA/slabs" },
  { slug: "sealed", label: "Sealed produkter" },
  { slug: "bulk", label: "Bulk / mange kort" },
] as const;

export type ListingCategory = (typeof LISTING_CATEGORY_OPTIONS)[number]["slug"];

const SLUG_SET = new Set<string>(
  LISTING_CATEGORY_OPTIONS.map((o) => o.slug),
);

export function parseListingCategory(
  raw: string | string[] | null | undefined,
): ListingCategory | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = String(s ?? "").trim();
  return SLUG_SET.has(trimmed) ? (trimmed as ListingCategory) : null;
}
