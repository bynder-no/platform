"use client";

import { useActionState, useMemo, useState } from "react";

import { updateDraftListing } from "./actions";

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";

const buttonClass =
  "rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

type EditListingFormProps = {
  listingId: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultPriceNok: number;
  defaultType: string;
  defaultAuctionEndsAt: string | null;
  defaultMinBidIncrementNok: number | null;
  defaultReservePriceNok: number | null;
  defaultContactThresholdPercent: number | null;
  defaultUseReservePrice: boolean;
};

function toDateTimeLocalValue(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function EditListingForm({
  listingId,
  defaultTitle,
  defaultDescription,
  defaultPriceNok,
  defaultType,
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
  const [reservePriceNok, setReservePriceNok] = useState(
    defaultReservePriceNok != null ? String(defaultReservePriceNok) : "",
  );
  const [contactThresholdPercent, setContactThresholdPercent] = useState(
    defaultContactThresholdPercent != null ? defaultContactThresholdPercent : 50,
  );
  const defaultAuctionEndsLocal = useMemo(
    () => toDateTimeLocalValue(defaultAuctionEndsAt),
    [defaultAuctionEndsAt],
  );
  const contactOpensAtNok = reservePriceNok
    ? Math.ceil((Number(reservePriceNok) * contactThresholdPercent) / 100)
    : null;

  return (
    <form action={formAction} className="mt-10 flex flex-col gap-4">
      <input type="hidden" name="listing_id" value={listingId} />

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          Title
        </span>
        <input
          type="text"
          name="title"
          required
          defaultValue={defaultTitle}
          className={inputClass}
          placeholder="Short title"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          Description
        </span>
        <textarea
          name="description"
          rows={4}
          defaultValue={defaultDescription}
          className={inputClass}
          placeholder="What are you offering?"
        />
      </label>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="font-medium text-zinc-800 dark:text-zinc-200">
          Listing type
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
          <span>Fixed price</span>
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
          <span>Auction</span>
        </label>
      </fieldset>

      {listingType === "auction" ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              Auction ends
            </span>
            <input
              type="datetime-local"
              name="auction_ends_at"
              required
              defaultValue={defaultAuctionEndsLocal}
              className={inputClass}
              aria-label="Auction end date and time"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              Minimum bid increment (NOK)
            </span>
            <input
              type="number"
              name="min_bid_increment_nok"
              min={5}
              step={1}
              required
              defaultValue={defaultMinBidIncrementNok ?? 5}
              className={inputClass}
              placeholder="5"
            />
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
            <input
              type="checkbox"
              name="use_reserve_price"
              checked={useReservePrice}
              onChange={(e) => setUseReservePrice(e.target.checked)}
              className="h-4 w-4 border-zinc-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <span>Enable reserve price</span>
          </label>

          {useReservePrice ? (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  Hidden minimum price (NOK)
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
              </label>

              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  Contact threshold (%)
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
                <input
                  type="number"
                  min={10}
                  max={70}
                  step={1}
                  value={contactThresholdPercent}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    if (Number.isFinite(next)) setContactThresholdPercent(next);
                  }}
                  className={inputClass}
                />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Contact opens at{" "}
                  {contactOpensAtNok != null && Number.isFinite(contactOpensAtNok)
                    ? `${contactOpensAtNok} NOK`
                    : "—"}
                </span>
              </label>
            </>
          ) : null}
        </>
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          {listingType === "auction" ? "Starting bid (NOK)" : "Price (NOK)"}
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

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Save changes"}
      </button>

      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
    </form>
  );
}
