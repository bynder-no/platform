import { NextResponse } from "next/server";

import { publicListingFeedOrFilter } from "@/app/listings/public-auction-feed-filter";
import {
  highestNokByListingId,
  type BidWithListingId,
} from "@/lib/highest-bid-nok";
import { createClient } from "@/lib/supabase/server";

type ListingSuggestionRow = {
  id: string;
  title: string | null;
  type: string | null;
  category: string | null;
  price_nok: number | string | null;
};

type ListingCategory = "single_card" | "slab" | "sealed" | "bulk";

const listingCategories = new Set<string>([
  "single_card",
  "slab",
  "sealed",
  "bulk",
]);

function isListingCategory(value: unknown): value is ListingCategory {
  return typeof value === "string" && listingCategories.has(value);
}

function escapeIlikeValue(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const pattern = `%${escapeIlikeValue(q)}%`;
  const { data, error } = await supabase
    .from("listings")
    .select("id, title, type, category, price_nok, created_at")
    .or(publicListingFeedOrFilter(nowIso))
    .in("type", ["auction", "fixed_price"])
    .ilike("title", pattern)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }

  const rows = ((data ?? []) as ListingSuggestionRow[]).filter(
    (row) => typeof row.id === "string" && row.id !== "",
  );
  const auctionIds = rows
    .filter((row) => row.type === "auction")
    .map((row) => row.id);
  let highestByListingId = new Map<string, number>();
  if (auctionIds.length > 0) {
    const { data: bidRows, error: bidsError } = await supabase
      .from("bids")
      .select("listing_id, amount_nok, created_at")
      .in("listing_id", auctionIds);
    if (!bidsError) {
      highestByListingId = highestNokByListingId((bidRows ?? []) as BidWithListingId[]);
    }
  }

  const categoryLabelBySlug = new Map<ListingCategory, string>([
    ["single_card", "Singelkort"],
    ["slab", "PSA/slabs"],
    ["sealed", "Sealed produkter"],
    ["bulk", "Bulk / mange kort"],
  ]);

  const suggestions = rows.map((row) => {
    const typeLabel = row.type === "auction" ? "Auksjon" : "Fastpris";
    const categoryLabel = isListingCategory(row.category)
      ? categoryLabelBySlug.get(row.category)!
      : "Ukjent kategori";
    const priceContext =
      row.type === "auction"
        ? `Høyeste bud: ${highestByListingId.get(row.id) ?? 0} NOK`
        : `Pris: ${Number.isFinite(Number(row.price_nok)) ? Number(row.price_nok) : 0} NOK`;
    return {
      id: row.id,
      title: (row.title ?? "").trim() || "—",
      typeLabel,
      categoryLabel,
      priceContext,
    };
  });

  return NextResponse.json({ suggestions });
}
