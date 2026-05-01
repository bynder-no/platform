"use client";

import { useActionState } from "react";

import { deleteDraftListing } from "@/app/listings/[id]/actions";

const buttonClass =
  "rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-50";

export function DeleteDraftForm({ listingId }: { listingId: string }) {
  const [state, formAction, pending] = useActionState(
    deleteDraftListing,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-1 sm:items-end">
      <input type="hidden" name="listing_id" value={listingId} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Deleting…" : "Delete"}
      </button>
      {state?.error ? (
        <p className="text-xs text-red-600">{state.error}</p>
      ) : null}
    </form>
  );
}
