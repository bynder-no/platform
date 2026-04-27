"use client";

import { useActionState } from "react";

import { markSellerReceivedPayment } from "./actions";

const buttonClass =
  "rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

type SellerReceivedPaymentFormProps = {
  listingId: string;
  /** Fastpris med flere kjøpere: hvilken kjøper denne deal-raden gjelder. */
  dealBidderId?: string;
};

export function SellerReceivedPaymentForm({
  listingId,
  dealBidderId,
}: SellerReceivedPaymentFormProps) {
  const [state, formAction, pending] = useActionState(
    markSellerReceivedPayment,
    null,
  );

  return (
    <form action={formAction} className="mt-2">
      <input type="hidden" name="listing_id" value={listingId} />
      {dealBidderId ? (
        <input type="hidden" name="deal_bidder_id" value={dealBidderId} />
      ) : null}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Registrerer…" : "Betaling mottatt"}
      </button>
      {state?.error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
