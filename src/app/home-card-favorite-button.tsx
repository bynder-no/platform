"use client";

import { useActionState } from "react";

import { toggleFavorite } from "@/app/listings/[id]/actions";

const buttonClass =
  "group inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white text-lg leading-none shadow-sm transition disabled:opacity-50";

function StarOutlineIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321 1.004l-4.096 3.534a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.874a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.385a.563.563 0 00-.182-.557l-4.096-3.535a.563.563 0 01.321-1.004l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
      />
    </svg>
  );
}

function StarFilledIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
        clipRule="evenodd"
      />
    </svg>
  );
}

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
        {pending ? (
          <span className="text-sm text-zinc-400">…</span>
        ) : isFavorite ? (
          <StarFilledIcon className="h-5 w-5 text-amber-500" />
        ) : (
          <StarOutlineIcon className="h-5 w-5 text-zinc-400 transition-colors group-hover:text-zinc-600" />
        )}
      </button>
      {state?.error ? (
        <p className="max-w-[7rem] text-right text-[10px] leading-tight text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
