"use client";

import { useActionState } from "react";

import { placeBid } from "@/app/listings/[id]/actions";

/** Matches listing detail quick bid (`ListingAuctionBidPanel`). */
const buttonClass =
  "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50";

type DashboardQuickBidFormProps = {
  listingId: string;
  amountNok: number;
  /** Merged with default form layout classes (e.g. shrink for inline rows). */
  className?: string;
};

export function DashboardQuickBidForm({
  listingId,
  amountNok,
  className,
}: DashboardQuickBidFormProps) {
  const [state, formAction, pending] = useActionState(placeBid, null);

  return (
    <form
      action={formAction}
      className={`flex w-full flex-col gap-1 sm:w-auto${className ? ` ${className}` : ""}`}
    >
      <input type="hidden" name="listing_id" value={listingId} />
      <input type="hidden" name="amount_nok" value={String(amountNok)} />
      <input type="hidden" name="return_to" value="/dashboard" />
      <button
        type="submit"
        disabled={pending}
        className={`${buttonClass} w-full sm:w-auto`}
      >
        {pending ? "Sender…" : `By ${amountNok} NOK`}
      </button>
      {state?.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
