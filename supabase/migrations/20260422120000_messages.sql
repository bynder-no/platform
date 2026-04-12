create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Users can view messages they sent or received"
  on public.messages
  for select
  to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

create policy "Users can insert messages as themselves"
  on public.messages
  for insert
  to authenticated
  with check (sender_id = auth.uid());
