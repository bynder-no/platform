"use client";

import { useActionState, useMemo, useState } from "react";

import { ListingImageSlotsInput } from "@/components/listing-image-slots-input";

import { updateDraftListing } from "./actions";

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-zinc-400 focus:ring-2";

const buttonClass =
  "rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50";

type EditListingFormProps = {
  listingId: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultPriceNok: number;
  defaultType: string;
  defaultImageUrls: string[];
  defaultAuctionStartsAt: string | null;
  defaultAuctionEndsAt: string | null;
  defaultMinBidIncrementNok: number | null;
  defaultReservePriceNok: number | null;
  defaultContactThresholdPercent: number | null;
  defaultUseReservePrice: boolean;
};

function toLocalDateAndTime(value: string | null) {
  if (!value) return { date: "", time: "" };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function EditListingForm({
  listingId,
  defaultTitle,
  defaultDescription,
  defaultPriceNok,
  defaultType,
  defaultImageUrls,
  defaultAuctionStartsAt,
  defaultAuctionEndsAt,
  defaultMinBidIncrementNok,
  defaultReservePriceNok,
  defaultContactThresholdPercent,
  defaultUseReservePrice,
}: EditListingFormProps) {
  const [state, formAction, pending] = useActionState(updateDraftListing, null);
  const [listingType, setListingType] = useState<"fixed_price" | "auction">(
    defaultType === "auction" ? "auction" : "fixed_price",
  );
  const [useReservePrice, setUseReservePrice] = useState(
    defaultType === "auction" ? defaultUseReservePrice : false,
  );
  const [minBidIncrementNok, setMinBidIncrementNok] = useState(
    defaultMinBidIncrementNok != null ? String(defaultMinBidIncrementNok) : "",
  );
  const [reservePriceNok, setReservePriceNok] = useState(
    defaultReservePriceNok != null ? String(defaultReservePriceNok) : "",
  );
  const [contactThresholdPercent, setContactThresholdPercent] = useState(
    defaultContactThresholdPercent != null ? defaultContactThresholdPercent : 50,
  );
  const defaultAuctionStartsLocal = useMemo(
    () => toLocalDateAndTime(defaultAuctionStartsAt),
    [defaultAuctionStartsAt],
  );
  const defaultAuctionEndsLocal = useMemo(
    () => toLocalDateAndTime(defaultAuctionEndsAt),
    [defaultAuctionEndsAt],
  );
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
  const hasPrefillStartTime = timeOptions.includes(defaultAuctionStartsLocal.time);
  const defaultStartTimeValue = hasPrefillStartTime ? defaultAuctionStartsLocal.time : "";
  const hasPrefillEndTime = timeOptions.includes(defaultAuctionEndsLocal.time);
  const defaultEndTimeValue = hasPrefillEndTime ? defaultAuctionEndsLocal.time : "";
  const contactOpensAtNok = reservePriceNok
    ? Math.ceil((Number(reservePriceNok) * contactThresholdPercent) / 100)
    : null;

  return (
    <form action={formAction} className="mt-10 flex flex-col gap-4">
      <input type="hidden" name="listing_id" value={listingId} />

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="font-medium text-zinc-800">
          Annonsetype
        </legend>
        <label className="flex cursor-pointer items-center gap-2 text-zinc-800">
          <input
            type="radio"
            name="type"
            value="fixed_price"
            checked={listingType === "fixed_price"}
            onChange={() => setListingType("fixed_price")}
            required
            className="h-4 w-4 border-zinc-300 text-zinc-900 focus:ring-zinc-400"
          />
          <span>Fastpris</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-zinc-800">
          <input
            type="radio"
            name="type"
            value="auction"
            checked={listingType === "auction"}
            onChange={() => setListingType("auction")}
            className="h-4 w-4 border-zinc-300 text-zinc-900 focus:ring-zinc-400"
          />
          <span>Auksjon</span>
        </label>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800">
          Tittel
        </span>
        <input
          type="text"
          name="title"
          required
          defaultValue={defaultTitle}
          className={inputClass}
          placeholder="Kort tittel"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800">
          Beskrivelse
        </span>
        <textarea
          name="description"
          rows={4}
          defaultValue={defaultDescription}
          className={inputClass}
          placeholder="Hva tilbyr du?"
        />
      </label>

      <ListingImageSlotsInput
        initialImageUrls={defaultImageUrls}
        showReplaceNote
      />

      {listingType === "auction" ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800">
              Startdato
            </span>
            <input
              type="date"
              name="auction_start_date"
              required
              defaultValue={defaultAuctionStartsLocal.date}
              className={inputClass}
              aria-label="Startdato"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800">
              Starttid
            </span>
            <select
              name="auction_start_time"
              required
              className={inputClass}
              aria-label="Starttid"
              defaultValue={defaultStartTimeValue}
            >
              <option value="" disabled>
                Velg klokkeslett
              </option>
              {!hasPrefillStartTime && defaultAuctionStartsLocal.time ? (
                <option value={defaultAuctionStartsLocal.time}>
                  {defaultAuctionStartsLocal.time}
                </option>
              ) : null}
              {timeOptions.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800">
              Sluttdato
            </span>
            <input
              type="date"
              name="auction_end_date"
              required
              defaultValue={defaultAuctionEndsLocal.date}
              className={inputClass}
              aria-label="Sluttdato"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800">
              Sluttid
            </span>
            <select
              name="auction_end_time"
              required
              className={inputClass}
              aria-label="Sluttid"
              defaultValue={defaultEndTimeValue}
            >
              <option value="" disabled>
                Velg klokkeslett
              </option>
              {!hasPrefillEndTime && defaultAuctionEndsLocal.time ? (
                <option value={defaultAuctionEndsLocal.time}>
                  {defaultAuctionEndsLocal.time}
                </option>
              ) : null}
              {timeOptions.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
            <span className="text-xs text-zinc-500">
              Auksjonen bruker norsk tid.
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800">
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
              className={inputClass}
              placeholder="5"
            />
            <span className="text-xs text-zinc-500">
              Hvert nye bud må være minst dette beløpet høyere enn gjeldende høyeste bud.
            </span>
            <span className="text-xs text-zinc-500">
              Startbud settes automatisk til samme beløp.
            </span>
            <span className="text-xs text-zinc-500">
              {minBidIncrementNok && /^\d+$/.test(minBidIncrementNok)
                ? `Startbud blir ${minBidIncrementNok} kr`
                : "Startbud blir satt automatisk når du velger minste budøkning."}
            </span>
          </label>

          <fieldset className="space-y-2 text-sm">
            <legend className="font-medium text-zinc-800">
              Vil du ha minstepris?
            </legend>
            <label className="flex cursor-pointer items-center gap-2 text-zinc-800">
              <input
                type="radio"
                name="use_reserve_price"
                value="on"
                checked={useReservePrice}
                onChange={() => setUseReservePrice(true)}
                className="h-4 w-4 border-zinc-300 text-zinc-900 focus:ring-zinc-400"
              />
              <span>Ja</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-zinc-800">
              <input
                type="radio"
                name="use_reserve_price"
                value="off"
                checked={!useReservePrice}
                onChange={() => setUseReservePrice(false)}
                className="h-4 w-4 border-zinc-300 text-zinc-900 focus:ring-zinc-400"
              />
              <span>Nei</span>
            </label>
          </fieldset>

          {useReservePrice ? (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-zinc-800">
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
                  className={inputClass}
                  placeholder="5"
                />
                <span className="text-xs text-zinc-500">
                  Må være minst 5 kr. Denne vises ikke til budgivere.
                </span>
              </label>

              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-zinc-800">
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
                  className="accent-zinc-900"
                />
                <p className="text-sm font-medium text-zinc-800">
                  {contactThresholdPercent}%
                </p>
                <span className="text-xs text-zinc-500">
                  Kontakt apnes ved{" "}
                  {contactOpensAtNok != null && Number.isFinite(contactOpensAtNok)
                    ? `${contactOpensAtNok} kr`
                    : "fyll inn minstepris"}
                </span>
                <span className="text-xs text-zinc-500">
                  {reservePriceNok
                    ? `Dette er ${contactThresholdPercent}% av ${reservePriceNok} kr`
                    : "Legg inn minstepris for å se beregningen."}
                </span>
              </label>

              <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                Nar auksjonen er ferdig, apnes kontakt bare hvis hoyeste bud nar
                kontaktgrensen du har valgt.
              </p>
            </>
          ) : (
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
              Når auksjonen er ferdig, får høyeste budgiver kontakt med deg uansett bud.
            </p>
          )}
        </>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800">
            Pris (NOK)
          </span>
          <input
            type="number"
            name="price_nok"
            min={5}
            step={1}
            required
            defaultValue={defaultPriceNok}
            className={inputClass}
            placeholder="5"
          />
        </label>
      )}

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Lagrer..." : "Lagre endringer"}
      </button>

      {state?.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}
    </form>
  );
}
