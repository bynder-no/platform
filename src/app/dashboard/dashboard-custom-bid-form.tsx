"use client";

import { useActionState } from "react";
import type { ChangeEvent } from "react";

import { placeBid } from "@/app/listings/[id]/actions";

/** Matches listing detail manual bid row (`ListingAuctionBidPanel`). */
const inputClass =
  "min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2";

const outlineButtonClass =
  "shrink-0 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50";

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
      className="flex w-full flex-col gap-2"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
        <button
          type="submit"
          disabled={pending}
          className={outlineButtonClass}
        >
          {pending ? "Sender…" : "Send bud"}
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        Minimum bud:{" "}
        <span className="tabular-nums font-medium text-zinc-700">
          {minNextBidNok} NOK
        </span>
      </p>
      {state?.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
