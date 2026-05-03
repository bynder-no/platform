"use client";

import { useActionState, useState, type FormEvent } from "react";
import type { ChangeEvent } from "react";

import { placeBid } from "./actions";

const sectionLabelClass =
  "text-xs font-semibold uppercase tracking-wide text-zinc-500";

const inputClass =
  "min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2";

const primaryButtonClass =
  "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50";

const outlineButtonClass =
  "shrink-0 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50";

/** Whole NOK amounts only (same idea as former PlaceBidForm). */
function integerNokFromInput(raw: string) {
  const s = raw.trimStart();
  const m = s.match(/^\d+/);
  return m ? m[0] : "";
}

type ListingAuctionBidPanelProps = {
  listingId: string;
  minBidNok: number | null;
};

export function ListingAuctionBidPanel({
  listingId,
  minBidNok,
}: ListingAuctionBidPanelProps) {
  const [state, formAction, pending] = useActionState(placeBid, null);
  const [clientError, setClientError] = useState<string | null>(null);

  function handleAmountChange(e: ChangeEvent<HTMLInputElement>) {
    const next = integerNokFromInput(e.target.value);
    if (e.target.value !== next) {
      e.target.value = next;
    }
    setClientError(null);
  }

  function validateManual(form: HTMLFormElement): string | null {
    if (minBidNok == null) {
      return "Kunne ikke beregne minimumsbud.";
    }
    const raw = String(new FormData(form).get("amount_nok") ?? "").trim();
    if (!/^\d+$/.test(raw)) {
      return "Skriv et helt tall i NOK.";
    }
    const n = Number(raw);
    if (!Number.isSafeInteger(n) || n < minBidNok) {
      return `Budet må være minst ${minBidNok} NOK.`;
    }
    return null;
  }

  function onManualSubmit(e: FormEvent<HTMLFormElement>) {
    setClientError(null);
    const err = validateManual(e.currentTarget);
    if (err) {
      e.preventDefault();
      setClientError(err);
    }
  }

  const displayError = clientError ?? state?.error;

  return (
    <section
      className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-4 sm:px-4"
      aria-labelledby="listing-auction-bid-heading"
    >
      <h2 id="listing-auction-bid-heading" className={sectionLabelClass}>
        Bud
      </h2>

      <div className="mt-4 flex flex-col gap-4">
        {minBidNok != null ? (
          <form
            action={formAction}
            className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
          >
            <input type="hidden" name="listing_id" value={listingId} />
            <input type="hidden" name="amount_nok" value={String(minBidNok)} />
            <button
              type="submit"
              disabled={pending}
              className={`${primaryButtonClass} w-full sm:w-auto`}
            >
              {pending ? "Sender…" : `By ${minBidNok} NOK`}
            </button>
          </form>
        ) : (
          <p className="text-sm text-zinc-600">
            Kunne ikke beregne neste gyldige bud (sjekk startpris og minste
            økning).
          </p>
        )}

        <div className="border-t border-zinc-200 pt-4">
          <p className="text-xs font-medium text-zinc-700">Egendefinert bud</p>
          <form
            action={formAction}
            onSubmit={onManualSubmit}
            className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <input type="hidden" name="listing_id" value={listingId} />
            <input
              type="text"
              name="amount_nok"
              inputMode="numeric"
              autoComplete="off"
              required
              disabled={minBidNok == null}
              placeholder={minBidNok != null ? String(minBidNok) : ""}
              aria-invalid={displayError ? true : undefined}
              onChange={handleAmountChange}
              className={inputClass}
            />
            <button
              type="submit"
              disabled={pending || minBidNok == null}
              className={outlineButtonClass}
            >
              {pending ? "Sender…" : "Send bud"}
            </button>
          </form>
          {minBidNok != null ? (
            <p className="mt-2 text-xs text-zinc-500">
              Minimum:{" "}
              <span className="tabular-nums font-medium text-zinc-700">
                {minBidNok} NOK
              </span>
            </p>
          ) : null}
        </div>

        {displayError ? (
          <p className="text-sm text-red-600" role="alert">
            {displayError}
          </p>
        ) : null}
      </div>
    </section>
  );
}
