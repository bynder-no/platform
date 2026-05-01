"use client";

import { useActionState } from "react";

import { sendListingMessage } from "./actions";

const inputClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-blue-500";

const buttonClass =
  "rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50";

type ContactSellerFormProps = {
  listingId: string;
};

export function ContactSellerForm({ listingId }: ContactSellerFormProps) {
  const [state, formAction, pending] = useActionState(sendListingMessage, null);

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-4">
      <input type="hidden" name="listing_id" value={listingId} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800">
          Message
        </span>
        <textarea
          name="body"
          rows={4}
          required
          className={inputClass}
          placeholder="Write a message about this listing…"
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Sending…" : "Send message"}
      </button>
      {state?.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}
    </form>
  );
}
