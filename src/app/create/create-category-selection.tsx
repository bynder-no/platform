import Link from "next/link";

import { LISTING_CATEGORY_OPTIONS } from "./listing-categories";

const cardClass =
  "flex min-h-[5.5rem] flex-col justify-center rounded-xl border border-zinc-200 bg-white px-5 py-4 text-left text-base font-semibold text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:border-zinc-500 dark:hover:bg-zinc-900 dark:focus-visible:outline-zinc-100";

export function CreateCategorySelection() {
  return (
    <section className="mt-10 space-y-6">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Hva skal du legge ut?
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {LISTING_CATEGORY_OPTIONS.map(({ slug, label }) => (
          <li key={slug}>
            <Link href={`/create?category=${slug}`} className={cardClass}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
