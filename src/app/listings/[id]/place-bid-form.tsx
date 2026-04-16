"use client";

import { useActionState } from "react";
import type { ChangeEvent } from "react";

import { placeBid } from "./actions";

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";

const buttonClass =
  "rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

const helperListClass =
  "list-inside list-disc space-y-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400";

type PlaceBidFormProps = {
  listingId: string;
  minBidNok: number | null;
};

/** Whole NOK amounts only: leading digits, stops at the first non-digit (e.g. 12.5 → 12). */
function integerNokFromInput(raw: string) {
  const s = raw.trimStart();
  const m = s.match(/^\d+/);
  return m ? m[0] : "";
}

export function PlaceBidForm({ listingId, minBidNok }: PlaceBidFormProps) {
  const [state, formAction, pending] = useActionState(placeBid, null);
  const helperId = "place-bid-rules";

  function handleAmountChange(e: ChangeEvent<HTMLInputElement>) {
    const next = integerNokFromInput(e.target.value);
    if (e.target.value !== next) {
      e.target.value = next;
    }
  }

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-4">
      <input type="hidden" name="listing_id" value={listingId} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          Your bid (NOK)
        </span>
        <input
          id="place-bid-amount"
          type="text"
          name="amount_nok"
          inputMode="numeric"
          autoComplete="off"
          required
          aria-describedby={helperId}
          className={inputClass}
          placeholder={minBidNok != null ? String(minBidNok) : ""}
          onChange={handleAmountChange}
        />
      </label>
      <div id={helperId} className="space-y-2">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {minBidNok != null ? (
            <>
              Minimum for your next bid:{" "}
              <span className="tabular-nums font-medium text-zinc-700 dark:text-zinc-300">
                {minBidNok} NOK
              </span>
            </>
          ) : (
            "Could not calculate the minimum bid right now."
          )}
        </p>
        <ul className={helperListClass}>
          <li>Bids must be whole numbers (no decimals).</li>
          <li>First bid starts at the listing start price.</li>
          <li>Next bids must be at least highest bid + listing increment.</li>
        </ul>
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Placing…" : "Place bid"}
      </button>
      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
    </form>
  );
}
