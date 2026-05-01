import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  pageHeaderClass,
  pageShellClass,
  pageTitleClass,
} from "@/lib/page-layout";

import { CreateCategorySelection } from "./create-category-selection";
import { CreateListingForm } from "./create-listing-form";
import { CreateTypeSelection } from "./create-type-selection";
import { parseListingCategory } from "./listing-categories";
import { parseListingType } from "./listing-type";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    category?: string | string[];
    type?: string | string[];
  }>;
};

export default async function CreateListingPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const sp = await searchParams;
  const category = parseListingCategory(sp.category);
  const listingType = parseListingType(sp.type);

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <div className="space-y-2">
          <h1 className={pageTitleClass}>Create listing</h1>
          <p className="text-sm text-zinc-600">
            Fastpris publiseres med en gang. Auksjoner lagres som kladd. Pris lagres i NOK.
          </p>
        </div>
      </header>
      {category == null ? (
        <CreateCategorySelection />
      ) : listingType == null ? (
        <CreateTypeSelection category={category} />
      ) : (
        <CreateListingForm category={category} listingType={listingType} />
      )}
      </div>
    </div>
  );
}
