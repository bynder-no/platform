-- won_auction: one row per winner per listing (dedupe even when already read).
-- Other types: unchanged unread-only dedupe.

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
  v_existing_unread_id uuid;
  v_existing_won_auction_id uuid;
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
    'deal_action_required',
    'seller_bid_received',
    'won_auction'
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

  if p_type = 'won_auction' then
    select n.id
      into v_existing_won_auction_id
    from public.notifications n
    where n.user_id = p_user_id
      and n.type = 'won_auction'
      and n.listing_id = p_listing_id
    order by n.created_at desc
    limit 1;

    if v_existing_won_auction_id is not null then
      return v_existing_won_auction_id;
    end if;
  else
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

  insert into public.notifications (user_id, type, listing_id, message)
  values (p_user_id, p_type, p_listing_id, p_message)
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

revoke all on function public.create_notification(uuid, text, uuid, text) from public;
grant execute on function public.create_notification(uuid, text, uuid, text) to authenticated;
