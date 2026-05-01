-- Optional buyer context on notifications + extend create_notification (5th param defaults null).

alter table public.notifications
  add column if not exists bidder_id uuid references public.profiles (id) on delete set null;

drop index if exists notifications_unique_event_idx;

create unique index notifications_unique_event_idx
  on public.notifications (user_id, type, listing_id, message, thread_id, bidder_id);

drop function if exists public.create_notification(uuid, text, uuid, text);

create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_listing_id uuid,
  p_message text,
  p_bidder_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_listing_seller uuid;
  v_listing_type text;
  v_top_bidder uuid;
  v_existing_unread_id uuid;
  v_existing_one_time_id uuid;
  v_notification_id uuid;
  v_fixed_actor_ok boolean;
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
    'deal_action_required',
    'seller_bid_received',
    'won_auction',
    'auction_no_result',
    'fixed_price_offer'
  ) then
    return null;
  end if;

  select l.seller_id, l.type
    into v_listing_seller, v_listing_type
  from public.listings l
  where l.id = p_listing_id;

  if v_listing_seller is null then
    return null;
  end if;

  v_fixed_actor_ok := false;
  if v_listing_type = 'fixed_price' then
    if v_actor = v_listing_seller then
      v_fixed_actor_ok := true;
    elsif exists (
      select 1
      from public.listing_deals d
      where d.listing_id = p_listing_id
        and d.bidder_id = v_actor
    ) then
      v_fixed_actor_ok := true;
    end if;

    if not v_fixed_actor_ok then
      return null;
    end if;
  else
    select b.bidder_id
      into v_top_bidder
    from public.bids b
    where b.listing_id = p_listing_id
    order by b.amount_nok desc nulls last, b.created_at desc nulls last
    limit 1;

    if v_actor <> v_listing_seller and (v_top_bidder is null or v_actor <> v_top_bidder) then
      return null;
    end if;
  end if;

  if p_type in ('won_auction', 'auction_no_result') then
    select n.id
      into v_existing_one_time_id
    from public.notifications n
    where n.user_id = p_user_id
      and n.type = p_type
      and n.listing_id = p_listing_id
    order by n.created_at desc
    limit 1;

    if v_existing_one_time_id is not null then
      return v_existing_one_time_id;
    end if;
  elsif p_type <> 'fixed_price_offer' then
    select n.id
      into v_existing_unread_id
    from public.notifications n
    where n.user_id = p_user_id
      and n.type = p_type
      and n.listing_id = p_listing_id
      and n.is_read = false
    order by n.created_at desc
    limit 1;

    if v_existing_unread_id is not null then
      return v_existing_unread_id;
    end if;
  end if;

  insert into public.notifications (user_id, type, listing_id, message, bidder_id)
  values (p_user_id, p_type, p_listing_id, p_message, p_bidder_id)
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

revoke all on function public.create_notification(uuid, text, uuid, text, uuid) from public;
grant execute on function public.create_notification(uuid, text, uuid, text, uuid) to authenticated;
