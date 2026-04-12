import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingProfile) {
    const { error: insertError } = await supabase
      .from("profiles")
      .insert({ id: user.id });

    if (insertError) {
      throw new Error(`Could not create profile: ${insertError.message}`);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-16">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Dashboard
      </h1>
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        Signed in as{" "}
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {user.email ?? "—"}
        </span>
      </p>
      <p className="mt-2 font-mono text-xs text-zinc-500 dark:text-zinc-500">
        {user.id}
      </p>
      <p className="mt-8">
        <Link
          href="/create"
          className="text-sm font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
        >
          Create a listing
        </Link>
      </p>
    </div>
  );
}
