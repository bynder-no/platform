"use client";

import { useActionState, useState } from "react";

import { submitFixedPriceOffer, type FixedPriceOfferState } from "./actions";

const textareaClass =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";

const buttonClass =
  "rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

type FixedPriceOfferFormProps = {
  listingId: string;
  defaultOfferNok: number;
};

export function FixedPriceOfferForm({
  listingId,
  defaultOfferNok,
}: FixedPriceOfferFormProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    FixedPriceOfferState,
    FormData
  >(submitFixedPriceOffer, null);

  return (
    <div className="mt-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={buttonClass}
        >
          Gi bud
        </button>
      ) : (
        <form action={formAction} className="max-w-md space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
          <input type="hidden" name="listing_id" value={listingId} />
          <label className="flex flex-col text-sm text-zinc-800 dark:text-zinc-200">
            <span className="font-medium">Ditt bud (NOK)</span>
            <input
              name="offer_price_nok"
              type="number"
              min={1}
              step={1}
              required
              defaultValue={defaultOfferNok}
              disabled={pending}
              className={textareaClass}
            />
          </label>
          <label className="flex flex-col text-sm text-zinc-800 dark:text-zinc-200">
            <span className="font-medium">
              Melding til selger{" "}
              <span className="font-normal text-zinc-500 dark:text-zinc-400">
                (valgfritt)
              </span>
            </span>
            <textarea
              name="message"
              rows={3}
              className={textareaClass}
              placeholder="Valgfritt — anbefales for å spørre om detaljer eller bekrefte interesse."
              disabled={pending}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className={buttonClass}>
              {pending ? "Sender…" : "Send bud"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setOpen(false)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
            >
              Avbryt
            </button>
          </div>
          {state?.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
          ) : null}
        </form>
      )}
    </div>
  );
}
