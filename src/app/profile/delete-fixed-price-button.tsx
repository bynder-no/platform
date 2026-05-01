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
      <button type="submit" className="ui-button-danger px-3 py-1.5 text-xs">
        Slett
      </button>
      {state?.error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
    </form>
  );
}
