-- Fixed-price delete from /profile and /my-listings targets active listings.
-- Existing policy only allowed delete when status = 'draft', so active rows
-- matched RLS for zero rows and the listing never disappeared.
create policy "Users can delete their own active fixed price listings"
  on public.listings
  for delete
  to authenticated
  using (
    auth.uid() = seller_id
    and type = 'fixed_price'
    and status = 'active'
  );
