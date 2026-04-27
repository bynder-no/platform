"use client";

import { useActionState } from "react";

import { submitDealRating } from "./actions";

const scoreButtonClass =
  "min-w-[2.75rem] rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm font-semibold tabular-nums text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

type DealRatingFormProps = {
  listingId: string;
  intro: string;
  fieldsetLegend: string;
  dealBidderId?: string;
};

export function DealRatingForm({
  listingId,
  intro,
  fieldsetLegend,
  dealBidderId,
}: DealRatingFormProps) {
  const [state, formAction, pending] = useActionState(submitDealRating, null);

  return (
    <div className="mt-4">
      <p className="text-zinc-600 dark:text-zinc-400">{intro}</p>
      <form action={formAction} className="mt-3">
        <input type="hidden" name="listing_id" value={listingId} />
        {dealBidderId ? (
          <input type="hidden" name="deal_bidder_id" value={dealBidderId} />
        ) : null}
        <fieldset>
          <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {fieldsetLegend}
          </legend>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
            1 = dårligst, 5 = best
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <button
                key={n}
                type="submit"
                name="score"
                value={String(n)}
                disabled={pending}
                className={scoreButtonClass}
                aria-label={`Gi ${n} av 5 poeng`}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>
        {state?.error ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
