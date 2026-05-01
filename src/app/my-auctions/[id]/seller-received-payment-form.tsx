"use client";

import { useActionState } from "react";

import { markSellerReceivedPayment } from "./actions";

const buttonClass =
  "rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50";

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
        <p className="mt-2 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
