import { LISTING_CATEGORY_OPTIONS, type ListingCategory } from "@/app/create/listing-categories";

const EMOJI_BY_SLUG: Record<ListingCategory, string> = {
  single_card: "🃏",
  slab: "🛡️",
  sealed: "📦",
  bulk: "🗂️",
};

export type HomeCategoryShortcut = {
  href: string;
  label: string;
  icon: string;
  slug: ListingCategory;
};

/** FINN-style home shortcuts → same category slugs as listing create + /search filter. */
export const HOME_CATEGORY_SHORTCUTS: HomeCategoryShortcut[] =
  LISTING_CATEGORY_OPTIONS.map((opt) => ({
    slug: opt.slug,
    label: opt.label,
    icon: EMOJI_BY_SLUG[opt.slug],
    href: `/search?category=${encodeURIComponent(opt.slug)}`,
  }));
