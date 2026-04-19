"use client";

import { useActionState } from "react";

import { toggleFavorite } from "@/app/listings/[id]/actions";

const buttonClass =
  "rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900";

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
        <p className="max-w-[7rem] text-right text-[10px] leading-tight text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
