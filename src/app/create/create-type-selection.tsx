import Link from "next/link";

import type { ListingCategory } from "./listing-categories";

const cardClass =
  "flex min-h-[5.5rem] flex-col justify-center rounded-xl border border-zinc-200 bg-white px-5 py-4 text-left text-base font-semibold text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900";

export function CreateTypeSelection({
  category,
}: {
  category: ListingCategory;
}) {
  return (
    <section className="mt-10 space-y-6">
      <h2 className="text-lg font-semibold text-zinc-900">
        Hvordan vil du selge?
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        <li>
          <Link
            href={`/create?category=${category}&type=auction`}
            className={cardClass}
          >
            Auksjon
          </Link>
        </li>
        <li>
          <Link
            href={`/create?category=${category}&type=fixed_price`}
            className={cardClass}
          >
            Fastpris
          </Link>
        </li>
      </ul>
    </section>
  );
}
