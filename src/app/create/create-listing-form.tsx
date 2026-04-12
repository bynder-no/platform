"use client";

import { useActionState } from "react";

import { createListing } from "./actions";

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";

const buttonClass =
  "rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

export function CreateListingForm() {
  const [state, formAction, pending] = useActionState(createListing, null);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          Title
        </span>
        <input
          type="text"
          name="title"
          required
          className={inputClass}
          placeholder="Short title"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          Description
        </span>
        <textarea
          name="description"
          rows={4}
          className={inputClass}
          placeholder="What are you offering?"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          Price (NOK)
        </span>
        <input
          type="number"
          name="price_nok"
          min={0}
          step="0.01"
          required
          className={inputClass}
          placeholder="0.00"
        />
      </label>

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Save as draft"}
      </button>

      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
    </form>
  );
}
