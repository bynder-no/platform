create table public.bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  bidder_id uuid not null references public.profiles (id) on delete cascade,
  amount_nok numeric not null,
  created_at timestamptz not null default now(),
  constraint bids_amount_positive check (amount_nok > 0)
);

alter table public.bids enable row level security;

create policy "Authenticated users can view bids"
  on public.bids
  for select
  to authenticated
  using (true);

create policy "Users can insert bids as themselves"
  on public.bids
  for insert
  to authenticated
  with check (bidder_id = auth.uid());
