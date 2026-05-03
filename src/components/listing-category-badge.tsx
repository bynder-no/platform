const LISTING_CATEGORY_BADGE_LABEL: Record<string, string> = {
  single_card: "Singelkort",
  slab: "PSA/slabs",
  sealed: "Sealed",
  bulk: "Bulk",
};

export function listingCategoryBadgeLabel(
  category: string | null | undefined,
): string | null {
  if (category == null || String(category).trim() === "") return null;
  const k = String(category).trim();
  return LISTING_CATEGORY_BADGE_LABEL[k] ?? null;
}

/** Small pill for listing cards (home, search). Renders nothing if unknown/missing. */
export function ListingCategoryBadge({
  category,
}: {
  category: string | null | undefined;
}) {
  const label = listingCategoryBadgeLabel(category);
  if (!label) return null;
  return (
    <span className="inline-flex w-fit max-w-full shrink-0 truncate rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs leading-none text-zinc-600">
      {label}
    </span>
  );
}
