"use client";

import { useActionState } from "react";

import { deleteFixedPriceListing } from "./actions";

type DeleteFixedPriceFormProps = {
  listingId: string;
  returnTo: "/profile" | "/my-listings";
};

const buttonClass =
  "rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800";

export function DeleteFixedPriceForm({
  listingId,
  returnTo,
}: DeleteFixedPriceFormProps) {
  const [state, formAction, pending] = useActionState(deleteFixedPriceListing, null);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-1"
      onSubmit={(event) => {
        const ok = window.confirm("Er du sikker på at du vil slette annonsen?");
        if (!ok) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="listing_id" value={listingId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Sletter..." : "Slett"}
      </button>
      {state?.error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
    </form>
  );
}
