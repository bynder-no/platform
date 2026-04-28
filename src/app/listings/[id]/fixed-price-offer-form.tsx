"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { submitFixedPriceOffer, type FixedPriceOfferState } from "./actions";

const textareaClass =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";

const buttonClass =
  "rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

type FixedPriceOfferFormProps = {
  listingId: string;
  defaultOfferNok: number;
  listingTitle: string;
  originalPriceNok: number | null;
  thumbnailUrl?: string | null;
};

export function FixedPriceOfferForm({
  listingId,
  defaultOfferNok,
  listingTitle,
  originalPriceNok,
  thumbnailUrl,
}: FixedPriceOfferFormProps) {
  const [open, setOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const firstFocusableRef = useRef<HTMLInputElement | null>(null);
  const [state, formAction, pending] = useActionState<
    FixedPriceOfferState,
    FormData
  >(submitFixedPriceOffer, null);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      firstFocusableRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  const onModalKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!pending) setOpen(false);
      return;
    }
    if (event.key !== "Tab") return;
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = modal.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="mt-3">
      <button type="button" onClick={() => setOpen(true)} className={buttonClass}>
        Gi bud
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50 p-2 sm:items-center sm:justify-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Din forespørsel"
          onKeyDown={onModalKeyDown}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) setOpen(false);
          }}
        >
          <div
            ref={modalRef}
            className="max-h-[95vh] w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-950 sm:max-w-lg sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Din forespørsel
                </h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Hvis du og selger har blitt enige om en annen pris, kan du skrive
                  den her.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                aria-label="Lukk"
                className="rounded-md border border-zinc-300 px-2 py-1 text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                ×
              </button>
            </div>

            <div className="mt-4 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
              <div className="flex items-start gap-3">
                {thumbnailUrl ? (
                  <Image
                    src={thumbnailUrl}
                    alt={`Bilde av ${listingTitle}`}
                    width={72}
                    height={72}
                    unoptimized
                    className="h-[72px] w-[72px] rounded-md border border-zinc-200 object-cover dark:border-zinc-700"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                    {listingTitle}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Originalpris{" "}
                    <span className="tabular-nums font-medium text-zinc-800 dark:text-zinc-200">
                      {originalPriceNok != null ? originalPriceNok : defaultOfferNok} NOK
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <form action={formAction} className="mt-4 space-y-3">
              <input type="hidden" name="listing_id" value={listingId} />
              <label className="flex flex-col text-sm text-zinc-800 dark:text-zinc-200">
                <span className="font-medium">Ditt bud (NOK)</span>
                <input
                  ref={firstFocusableRef}
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
                  rows={4}
                  className={textareaClass}
                  placeholder="Kjøper gjerne denne :)"
                  disabled={pending}
                />
              </label>
              {state?.error ? (
                <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
              ) : null}
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
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
