"use client";

import { useActionState } from "react";

import { placeBid } from "@/app/listings/[id]/actions";

const buttonClass =
  "rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50";

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
    <form
      action={formAction}
      className="flex w-full flex-col gap-1 sm:w-auto sm:items-end"
    >
      <input type="hidden" name="listing_id" value={listingId} />
      <input type="hidden" name="amount_nok" value={String(amountNok)} />
      <input type="hidden" name="return_to" value="/dashboard" />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Sender…" : `By ${amountNok} NOK`}
      </button>
      {state?.error ? (
        <p className="max-w-xs text-right text-xs text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
