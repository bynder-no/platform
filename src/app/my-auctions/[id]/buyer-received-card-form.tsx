"use client";

import { useActionState } from "react";

import { markBuyerReceivedCard } from "./actions";

const buttonClass =
  "rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

type BuyerReceivedCardFormProps = {
  listingId: string;
};

export function BuyerReceivedCardForm({ listingId }: BuyerReceivedCardFormProps) {
  const [state, formAction, pending] = useActionState(
    markBuyerReceivedCard,
    null,
  );

  return (
    <form action={formAction} className="mt-2">
      <input type="hidden" name="listing_id" value={listingId} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Registrerer…" : "Kort mottatt"}
      </button>
      {state?.error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
