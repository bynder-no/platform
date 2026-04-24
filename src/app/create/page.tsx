import { redirect } from "next/navigation";

import { SignedInNavLinks } from "@/components/signed-in-nav-links";
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
    <div className={pageShellClass}>
      <header className={pageHeaderClass}>
        <div className="space-y-2">
          <h1 className={pageTitleClass}>Create listing</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            New listings are saved as drafts. Price is stored in NOK.
          </p>
        </div>
        <SignedInNavLinks />
      </header>
      {category == null ? (
        <CreateCategorySelection />
      ) : listingType == null ? (
        <CreateTypeSelection category={category} />
      ) : (
        <CreateListingForm category={category} listingType={listingType} />
      )}
    </div>
  );
}
