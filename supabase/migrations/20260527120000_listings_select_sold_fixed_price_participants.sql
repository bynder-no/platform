-- Allow sold fixed-price listing metadata to be visible to deal participants.
-- This keeps sold listings hidden publicly while preserving Mine deals cards
-- for seller and buyer tied to listing_deals.
create policy "Users can view sold fixed price listings in their deals"
  on public.listings
  for select
  to authenticated
  using (
    type = 'fixed_price'
    and status = 'sold'
    and exists (
      select 1
      from public.listing_deals d
      where d.listing_id = public.listings.id
        and (d.seller_id = auth.uid() or d.bidder_id = auth.uid())
    )
  );
