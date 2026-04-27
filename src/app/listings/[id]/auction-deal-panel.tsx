"use client";

import { useActionState } from "react";

import { setListingDealDecision } from "./actions";
import { listingDealOutcomeText } from "./deal-status";

const buttonClass =
  "rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

const outlineButtonClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900";

type AuctionDealPanelProps = {
  listingId: string;
  sellerDecision: string;
  bidderDecision: string;
  showSellerButtons: boolean;
  showBidderButtons: boolean;
  /** When set, server action redirects back here after Deal / No deal (must match listing id). */
  returnToAfterDecision?: string;
  /** When set, replaces the default outcome line (e.g. personalized «Deal venter» copy in dealrom). */
  outcomeTextOverride?: string;
  /** Fixed-price: the buyer (bidder) this deal row belongs to — required for `setListingDealDecision`. */
  dealBidderId?: string;
};

export function AuctionDealPanel({
  listingId,
  sellerDecision,
  bidderDecision,
  showSellerButtons,
  showBidderButtons,
  returnToAfterDecision,
  outcomeTextOverride,
  dealBidderId,
}: AuctionDealPanelProps) {
  const [state, formAction, pending] = useActionState(setListingDealDecision, null);
  const outcome =
    typeof outcomeTextOverride === "string"
      ? outcomeTextOverride
      : listingDealOutcomeText(sellerDecision, bidderDecision);

  return (
    <div className="mt-3 space-y-4">
      <p className="text-zinc-700 dark:text-zinc-300">{outcome}</p>

      {showSellerButtons ? (
        <form action={formAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="listing_id" value={listingId} />
          <input type="hidden" name="role" value="seller" />
          {dealBidderId ? (
            <input type="hidden" name="deal_bidder_id" value={dealBidderId} />
          ) : null}
          {returnToAfterDecision ? (
            <input type="hidden" name="return_to" value={returnToAfterDecision} />
          ) : null}
          <button
            type="submit"
            name="decision"
            value="deal"
            disabled={pending}
            className={buttonClass}
          >
            Deal
          </button>
          <button
            type="submit"
            name="decision"
            value="no_deal"
            disabled={pending}
            className={outlineButtonClass}
          >
            No deal
          </button>
        </form>
      ) : null}

      {showBidderButtons ? (
        <form action={formAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="listing_id" value={listingId} />
          <input type="hidden" name="role" value="bidder" />
          {dealBidderId ? (
            <input type="hidden" name="deal_bidder_id" value={dealBidderId} />
          ) : null}
          {returnToAfterDecision ? (
            <input type="hidden" name="return_to" value={returnToAfterDecision} />
          ) : null}
          <button
            type="submit"
            name="decision"
            value="deal"
            disabled={pending}
            className={buttonClass}
          >
            Deal
          </button>
          <button
            type="submit"
            name="decision"
            value="no_deal"
            disabled={pending}
            className={outlineButtonClass}
          >
            No deal
          </button>
        </form>
      ) : null}

      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
    </div>
  );
}
