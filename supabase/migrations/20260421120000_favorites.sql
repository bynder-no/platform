create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint favorites_user_listing_unique unique (user_id, listing_id)
);

alter table public.favorites enable row level security;

create policy "Users can view their own favorites"
  on public.favorites
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert their own favorites"
  on public.favorites
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can delete their own favorites"
  on public.favorites
  for delete
  to authenticated
  using (user_id = auth.uid());
