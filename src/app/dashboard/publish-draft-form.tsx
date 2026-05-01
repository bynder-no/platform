"use client";

import { useActionState } from "react";

import { publishListing } from "@/app/listings/[id]/actions";

const buttonClass =
  "rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50";

export function PublishDraftForm({ listingId }: { listingId: string }) {
  const [state, formAction, pending] = useActionState(publishListing, null);

  return (
    <form action={formAction} className="flex flex-col gap-1 sm:items-end">
      <input type="hidden" name="listing_id" value={listingId} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Publishing…" : "Publish"}
      </button>
      {state?.error ? (
        <p className="text-xs text-red-600">{state.error}</p>
      ) : null}
    </form>
  );
}
