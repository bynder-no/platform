"use client";

import { useActionState } from "react";

import { sendListingDealMessage } from "./actions";

const textareaClass =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";

const buttonClass =
  "rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

type DealChatFormProps = {
  listingId: string;
  /** Fixed-price deal thread (buyer uuid for this row). */
  dealBidderId?: string;
};

export function DealChatForm({
  listingId,
  dealBidderId,
}: DealChatFormProps) {
  const [state, formAction, pending] = useActionState(
    sendListingDealMessage,
    null,
  );

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="listing_id" value={listingId} />
      {dealBidderId ? (
        <input type="hidden" name="deal_bidder_id" value={dealBidderId} />
      ) : null}
      <label className="flex flex-col text-sm text-zinc-800 dark:text-zinc-200">
        <span className="font-medium">Ny melding</span>
        <textarea
          name="body"
          rows={3}
          className={textareaClass}
          placeholder="Skriv en melding…"
          disabled={pending}
        />
      </label>
      <button type="submit" disabled={pending} className={`${buttonClass} w-fit`}>
        {pending ? "Sender…" : "Send"}
      </button>
      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
    </form>
  );
}
