import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { CreateListingForm } from "./create-listing-form";

export const dynamic = "force-dynamic";

export default async function CreateListingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-16">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Create listing
        </h1>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
        >
          Dashboard
        </Link>
      </div>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        New listings are saved as drafts. Price is stored in NOK.
      </p>
      <CreateListingForm />
    </div>
  );
}
