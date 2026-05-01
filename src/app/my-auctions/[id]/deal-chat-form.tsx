"use client";

import { useActionState } from "react";

import { sendListingDealMessage } from "./actions";

const textareaClass =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2";

const buttonClass =
  "rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50";

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
      <label className="flex flex-col text-sm text-zinc-800">
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
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}
    </form>
  );
}
