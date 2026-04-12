create policy "Anonymous users can view bids"
  on public.bids
  for select
  to anon
  using (true);
