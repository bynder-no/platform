"use client";

import { useActionState } from "react";

import { placeBid } from "@/app/listings/[id]/actions";

const buttonClass =
  "rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

type DashboardQuickBidFormProps = {
  listingId: string;
  amountNok: number;
};

export function DashboardQuickBidForm({
  listingId,
  amountNok,
}: DashboardQuickBidFormProps) {
  const [state, formAction, pending] = useActionState(placeBid, null);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="listing_id" value={listingId} />
      <input type="hidden" name="amount_nok" value={String(amountNok)} />
      <input type="hidden" name="return_to" value="/dashboard" />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Sender…" : `By ${amountNok} NOK`}
      </button>
      {state?.error ? (
        <p className="max-w-xs text-right text-xs text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
