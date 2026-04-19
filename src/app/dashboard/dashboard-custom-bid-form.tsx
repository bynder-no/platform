"use client";

import { useActionState } from "react";
import type { ChangeEvent } from "react";

import { placeBid } from "@/app/listings/[id]/actions";

const inputClass =
  "w-full min-w-[6rem] max-w-[10rem] rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50 sm:w-auto";

const buttonClass =
  "rounded-md bg-zinc-900 px-3 py-1 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

function integerNokFromInput(raw: string) {
  const s = raw.trimStart();
  const m = s.match(/^\d+/);
  return m ? m[0] : "";
}

type DashboardCustomBidFormProps = {
  listingId: string;
  minNextBidNok: number;
};

export function DashboardCustomBidForm({
  listingId,
  minNextBidNok,
}: DashboardCustomBidFormProps) {
  const [state, formAction, pending] = useActionState(placeBid, null);

  function handleAmountChange(e: ChangeEvent<HTMLInputElement>) {
    const next = integerNokFromInput(e.target.value);
    if (e.target.value !== next) {
      e.target.value = next;
    }
  }

  return (
    <form
      action={formAction}
      className="flex w-full flex-col gap-1 sm:items-end"
    >
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <input type="hidden" name="listing_id" value={listingId} />
        <input type="hidden" name="return_to" value="/dashboard" />
        <input
          name="amount_nok"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          required
          placeholder={String(minNextBidNok)}
          aria-label="Annet bud (NOK)"
          onChange={handleAmountChange}
          className={inputClass}
        />
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Sender…" : "Send bud"}
        </button>
      </div>
      {state?.error ? (
        <p className="max-w-xs text-right text-xs text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
