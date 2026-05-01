"use client";

import { useActionState } from "react";

import { toggleFavorite } from "@/app/listings/[id]/actions";

const buttonClass =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-lg leading-none text-amber-500 shadow-sm transition hover:border-amber-300 hover:bg-amber-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-amber-400 dark:hover:border-amber-700 dark:hover:bg-amber-950/40";

type HomeCardFavoriteButtonProps = {
  listingId: string;
  isFavorite: boolean;
  /** Same-origin path only; defaults to home `/`. */
  returnTo?: string;
};

export function HomeCardFavoriteButton({
  listingId,
  isFavorite,
  returnTo = "/",
}: HomeCardFavoriteButtonProps) {
  const [state, formAction, pending] = useActionState(toggleFavorite, null);

  return (
    <form
      action={formAction}
      className="flex shrink-0 flex-col items-end gap-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      <input type="hidden" name="listing_id" value={listingId} />
      <input type="hidden" name="return_to" value={returnTo} />
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
