"use client";

import { useActionState } from "react";

import { toggleFavorite } from "./actions";

const defaultButtonClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-50";

type FavoriteButtonProps = {
  listingId: string;
  isFavorite: boolean;
  formClassName?: string;
  buttonClassName?: string;
};

export function FavoriteButton({
  listingId,
  isFavorite,
  formClassName,
  buttonClassName,
}: FavoriteButtonProps) {
  const [state, formAction, pending] = useActionState(toggleFavorite, null);

  return (
    <form action={formAction} className={formClassName ?? "mt-6"}>
      <input type="hidden" name="listing_id" value={listingId} />
      <button
        type="submit"
        disabled={pending}
        className={buttonClassName ?? defaultButtonClass}
      >
        {pending
          ? isFavorite
            ? "Removing…"
            : "Saving…"
          : isFavorite
            ? "Remove favorite"
            : "Save to favorites"}
      </button>
      {state?.error ? (
        <p className="mt-2 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
