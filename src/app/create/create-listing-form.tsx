"use client";

import { useActionState, useMemo, useState } from "react";

import { createListing } from "./actions";
import type { ListingCategory } from "./listing-categories";
import type { ListingTypeChoice } from "./listing-type";

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";

/** Minste budøkning / minstepris: no wheel nudge, no spin buttons (webkit + Firefox). */
const auctionNumberInputClass = `${inputClass} [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`;

const buttonClass =
  "rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

export function CreateListingForm({
  category,
  listingType: initialListingType,
}: {
  category: ListingCategory;
  listingType: ListingTypeChoice;
}) {
  const [state, formAction, pending] = useActionState(createListing, null);
  const [listingType, setListingType] = useState<ListingTypeChoice>(
    initialListingType,
  );
  const [useReservePrice, setUseReservePrice] = useState(true);
  const [reservePriceNok, setReservePriceNok] = useState("");
  const [contactThresholdPercent, setContactThresholdPercent] = useState(50);
  const [minBidIncrementNok, setMinBidIncrementNok] = useState("");
  const contactOpensAtNok = reservePriceNok
    ? Math.ceil((Number(reservePriceNok) * contactThresholdPercent) / 100)
    : null;
  const timeOptions = useMemo(() => {
    const options: string[] = [];
    for (let hour = 0; hour < 24; hour += 1) {
      for (let minute = 0; minute < 60; minute += 1) {
        options.push(
          `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
        );
      }
    }
    return options;
  }, []);

  return (
    <form action={formAction} className="mt-10 flex flex-col gap-4">
      <input type="hidden" name="category" value={category} />
      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="font-medium text-zinc-800 dark:text-zinc-200">
          Annonsetype
        </legend>
        <label className="flex cursor-pointer items-center gap-2 text-zinc-800 dark:text-zinc-200">
          <input
            type="radio"
            name="type"
            value="fixed_price"
            checked={listingType === "fixed_price"}
            onChange={() => setListingType("fixed_price")}
            required
            className="h-4 w-4 border-zinc-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <span>Fastpris</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-zinc-800 dark:text-zinc-200">
          <input
            type="radio"
            name="type"
            value="auction"
            checked={listingType === "auction"}
            onChange={() => setListingType("auction")}
            className="h-4 w-4 border-zinc-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <span>Auksjon</span>
        </label>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          Tittel
        </span>
        <input
          type="text"
          name="title"
          required
          className={inputClass}
          placeholder="Kort tittel"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          Beskrivelse
        </span>
        <textarea
          name="description"
          rows={4}
          className={inputClass}
          placeholder="Hva tilbyr du?"
        />
      </label>

      {listingType === "auction" ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              Startdato
            </span>
            <input
              type="date"
              name="auction_start_date"
              required
              className={inputClass}
              aria-label="Startdato"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              Starttid
            </span>
            <select
              name="auction_start_time"
              required
              className={inputClass}
              aria-label="Starttid"
              defaultValue=""
            >
              <option value="" disabled>
                Velg klokkeslett
              </option>
              {timeOptions.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              Sluttdato
            </span>
            <input
              type="date"
              name="auction_end_date"
              required
              className={inputClass}
              aria-label="Sluttdato"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              Sluttid
            </span>
            <select
              name="auction_end_time"
              required
              className={inputClass}
              aria-label="Sluttid"
              defaultValue=""
            >
              <option value="" disabled>
                Velg klokkeslett
              </option>
              {timeOptions.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Auksjonen bruker norsk tid.
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              Minste budøkning
            </span>
            <input
              type="number"
              name="min_bid_increment_nok"
              min={5}
              step={1}
              required
              value={minBidIncrementNok}
              onChange={(e) => setMinBidIncrementNok(e.target.value)}
              onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
              className={auctionNumberInputClass}
              placeholder="5"
            />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Hvert nye bud må være minst dette beløpet høyere enn gjeldende høyeste bud.
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Startbud settes automatisk til samme beløp.
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {minBidIncrementNok && /^\d+$/.test(minBidIncrementNok)
                ? `Startbud blir ${minBidIncrementNok} kr`
                : "Startbud blir satt automatisk når du velger minste budøkning."}
            </span>
          </label>

          <fieldset className="space-y-2 text-sm">
            <legend className="font-medium text-zinc-800 dark:text-zinc-200">
              Vil du ha minstepris?
            </legend>
            <label className="flex cursor-pointer items-center gap-2 text-zinc-800 dark:text-zinc-200">
              <input
                type="radio"
                name="use_reserve_price"
                value="on"
                checked={useReservePrice}
                onChange={() => setUseReservePrice(true)}
                className="h-4 w-4 border-zinc-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <span>Ja</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-zinc-800 dark:text-zinc-200">
              <input
                type="radio"
                name="use_reserve_price"
                value="off"
                checked={!useReservePrice}
                onChange={() => setUseReservePrice(false)}
                className="h-4 w-4 border-zinc-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <span>Nei</span>
            </label>
          </fieldset>

          {useReservePrice ? (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  Minstepris
                </span>
                <input
                  type="number"
                  name="reserve_price_nok"
                  min={5}
                  step={1}
                  required
                  value={reservePriceNok}
                  onChange={(e) => setReservePriceNok(e.target.value)}
                  onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                  className={auctionNumberInputClass}
                  placeholder="5"
                />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Må være minst 5 kr. Denne vises ikke til budgivere.
                </span>
              </label>

              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  Kontaktgrense (%)
                </span>
                <input
                  type="range"
                  name="contact_threshold_percent"
                  min={10}
                  max={70}
                  step={1}
                  value={contactThresholdPercent}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    if (Number.isFinite(next)) setContactThresholdPercent(next);
                  }}
                  className="accent-zinc-900 dark:accent-zinc-100"
                />
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {contactThresholdPercent}%
                </p>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Kontakt apnes ved{" "}
                  {contactOpensAtNok != null && Number.isFinite(contactOpensAtNok)
                    ? `${contactOpensAtNok} kr`
                    : "fyll inn minstepris"}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {reservePriceNok
                    ? `Dette er ${contactThresholdPercent}% av ${reservePriceNok} kr`
                    : "Legg inn minstepris for å se beregningen."}
                </span>
              </label>

              <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                Nar auksjonen er ferdig, apnes kontakt bare hvis hoyeste bud nar
                kontaktgrensen du har valgt.
              </p>
            </>
          ) : (
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              Når auksjonen er ferdig, får høyeste budgiver kontakt med deg uansett bud.
            </p>
          )}
        </>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            Pris (NOK)
          </span>
          <input
            type="number"
            name="price_nok"
            min={5}
            step={1}
            required
            className={inputClass}
            placeholder="5"
          />
        </label>
      )}

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Publiserer..." : "Publiser annonse"}
      </button>

      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
    </form>
  );
}
