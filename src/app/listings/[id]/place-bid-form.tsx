"use client";

import { useActionState } from "react";

import { placeBid } from "./actions";

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";

const buttonClass =
  "rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

type PlaceBidFormProps = {
  listingId: string;
};

export function PlaceBidForm({ listingId }: PlaceBidFormProps) {
  const [state, formAction, pending] = useActionState(placeBid, null);

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-4">
      <input type="hidden" name="listing_id" value={listingId} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          Your bid (NOK)
        </span>
        <input
          type="number"
          name="amount_nok"
          min={0.01}
          step="0.01"
          required
          className={inputClass}
          placeholder="0.00"
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Placing…" : "Place bid"}
      </button>
      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
    </form>
  );
}
