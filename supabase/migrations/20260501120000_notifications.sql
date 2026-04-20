create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (
    type in (
      'outbid',
      'deal_relevant',
      'no_successful_result',
      'deal_requires_action',
      'rating_available'
    )
  ),
  listing_id uuid not null references public.listings (id) on delete cascade,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create unique index notifications_unique_event_idx
  on public.notifications (user_id, type, listing_id, message);

alter table public.notifications enable row level security;

create policy "Users can view own notifications"
  on public.notifications
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can mark own notifications as read"
  on public.notifications
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_listing_id uuid,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_listing_seller uuid;
  v_top_bidder uuid;
  v_notification_id uuid;
begin
  v_actor := auth.uid();
  if v_actor is null then
    return null;
  end if;

  if p_user_id is null or p_listing_id is null then
    return null;
  end if;

  if p_message is null or btrim(p_message) = '' then
    return null;
  end if;

  if p_type not in (
    'outbid',
    'deal_relevant',
    'no_successful_result',
    'deal_requires_action',
    'rating_available'
  ) then
    return null;
  end if;

  select l.seller_id
    into v_listing_seller
  from public.listings l
  where l.id = p_listing_id;

  if v_listing_seller is null then
    return null;
  end if;

  select b.bidder_id
    into v_top_bidder
  from public.bids b
  where b.listing_id = p_listing_id
  order by b.amount_nok desc nulls last, b.created_at desc nulls last
  limit 1;

  if v_actor <> v_listing_seller and (v_top_bidder is null or v_actor <> v_top_bidder) then
    return null;
  end if;

  insert into public.notifications (user_id, type, listing_id, message)
  values (p_user_id, p_type, p_listing_id, p_message)
  on conflict (user_id, type, listing_id, message) do nothing
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

revoke all on function public.create_notification(uuid, text, uuid, text) from public;
grant execute on function public.create_notification(uuid, text, uuid, text) to authenticated;
