create table if not exists public.listing_image_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  image_url text not null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.listing_image_reports enable row level security;

create policy "Users can insert listing image reports as themselves"
  on public.listing_image_reports
  for insert
  to authenticated
  with check (reporter_id = auth.uid());

create policy "Users can view own listing image reports"
  on public.listing_image_reports
  for select
  to authenticated
  using (reporter_id = auth.uid());
