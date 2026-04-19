"use client";

import { useActionState } from "react";

import { toggleFavorite } from "@/app/listings/[id]/actions";

const buttonClass =
  "shrink-0 rounded p-0.5 text-lg leading-none text-amber-500 transition hover:bg-zinc-100 disabled:opacity-50 dark:text-amber-400 dark:hover:bg-zinc-800";

type HomeCardFavoriteButtonProps = {
  listingId: string;
  isFavorite: boolean;
};

export function HomeCardFavoriteButton({
  listingId,
  isFavorite,
}: HomeCardFavoriteButtonProps) {
  const [state, formAction, pending] = useActionState(toggleFavorite, null);

  return (
    <form
      action={formAction}
      className="flex shrink-0 flex-col items-end gap-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      <input type="hidden" name="listing_id" value={listingId} />
      <input type="hidden" name="return_to" value="/" />
      <button
        type="submit"
        disabled={pending}
        className={buttonClass}
        aria-pressed={isFavorite}
        aria-label={
          isFavorite ? "Fjern fra favoritter" : "Legg til i favoritter"
        }
        title={isFavorite ? "Fjern fra favoritter" : "Legg til i favoritter"}
      >
        {pending ? "…" : isFavorite ? "★" : "☆"}
      </button>
      {state?.error ? (
        <p className="max-w-[6rem] text-right text-[10px] leading-tight text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
