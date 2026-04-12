"use client";

import { useActionState } from "react";

import { sendListingMessage } from "./actions";

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";

const buttonClass =
  "rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

type ContactSellerFormProps = {
  listingId: string;
};

export function ContactSellerForm({ listingId }: ContactSellerFormProps) {
  const [state, formAction, pending] = useActionState(sendListingMessage, null);

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-4">
      <input type="hidden" name="listing_id" value={listingId} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
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
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
    </form>
  );
}
