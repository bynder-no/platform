"use client";

import { useActionState } from "react";

import { deleteFixedPriceListing } from "../listings/[id]/actions";

type DeleteFixedPriceButtonProps = {
  listingId: string;
};

export function DeleteFixedPriceButton({
  listingId,
}: DeleteFixedPriceButtonProps) {
  const [state, formAction] = useActionState(deleteFixedPriceListing, null);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const ok = window.confirm("Er du sikker på at du vil slette annonsen?");
        if (!ok) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="listing_id" value={listingId} />
      <input type="hidden" name="return_to" value="/profile" />
      <button
        type="submit"
        className="inline-flex rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Slett
      </button>
      {state?.error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
    </form>
  );
}
