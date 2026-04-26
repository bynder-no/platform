"use client";

import { deleteOwnFixedPriceListing } from "./actions";

type DeleteFixedPriceButtonProps = {
  listingId: string;
};

export function DeleteFixedPriceButton({
  listingId,
}: DeleteFixedPriceButtonProps) {
  return (
    <form
      action={deleteOwnFixedPriceListing}
      onSubmit={(event) => {
        const ok = window.confirm("Er du sikker på at du vil slette annonsen?");
        if (!ok) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="listing_id" value={listingId} />
      <button
        type="submit"
        className="inline-flex rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Slett
      </button>
    </form>
  );
}
