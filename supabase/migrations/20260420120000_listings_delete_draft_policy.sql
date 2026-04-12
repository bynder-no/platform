create policy "Users can delete their own draft listings"
  on public.listings
  for delete
  to authenticated
  using (auth.uid() = seller_id and status = 'draft');
