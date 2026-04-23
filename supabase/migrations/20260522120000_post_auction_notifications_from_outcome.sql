-- Post-auction notifications driven by resolved listings.auction_outcome.
-- Security definer: create_notification RPC restricts callers to seller/top bidder;
-- this function runs after DB resolution so any session can trigger idempotent inserts.

create or replace function public.create_post_auction_notifications_for_resolved_auction(
  p_listing_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_outcome text;
  v_seller_id uuid;
  v_title text;
  v_ends timestamptz;
  v_top_bidder uuid;
  v_existing uuid;
  v_title_display text;
begin
  select
    l.type,
    l.auction_outcome,
    l.seller_id,
    l.title,
    l.auction_ends_at
  into
    v_type,
    v_outcome,
    v_seller_id,
    v_title,
    v_ends
  from public.listings l
  where l.id = p_listing_id;

  if not found then
    return;
  end if;

  if v_type is distinct from 'auction' then
    return;
  end if;

  if v_ends is null or now() < v_ends then
    return;
  end if;

  if v_outcome is null
     or v_outcome = 'pending'
     or v_outcome not in ('deal_opened', 'no_bids', 'threshold_not_met') then
    return;
  end if;

  if v_seller_id is null then
    return;
  end if;

  v_title_display := coalesce(nullif(trim(v_title), ''), 'auksjonen');

  select b.bidder_id
    into v_top_bidder
  from public.bids b
  where b.listing_id = p_listing_id
  order by b.amount_nok desc nulls last, b.created_at desc nulls last
  limit 1;

  if v_outcome = 'deal_opened' then
    if v_top_bidder is null then
      return;
    end if;

    select n.id
      into v_existing
    from public.notifications n
    where n.user_id = v_top_bidder
      and n.type = 'won_auction'
      and n.listing_id = p_listing_id
    limit 1;

    if v_existing is null then
      insert into public.notifications (user_id, type, listing_id, message)
      values (
        v_top_bidder,
        'won_auction',
        p_listing_id,
        'Du vant auksjonen: ' || v_title_display
      );
    end if;

  elsif v_outcome = 'no_bids' then
    select n.id
      into v_existing
    from public.notifications n
    where n.user_id = v_seller_id
      and n.type = 'auction_no_result'
      and n.listing_id = p_listing_id
    limit 1;

    if v_existing is null then
      insert into public.notifications (user_id, type, listing_id, message)
      values (
        v_seller_id,
        'auction_no_result',
        p_listing_id,
        'Auksjonen endte uten bud'
      );
    end if;

  elsif v_outcome = 'threshold_not_met' then
    select n.id
      into v_existing
    from public.notifications n
    where n.user_id = v_seller_id
      and n.type = 'auction_no_result'
      and n.listing_id = p_listing_id
    limit 1;

    if v_existing is null then
      insert into public.notifications (user_id, type, listing_id, message)
      values (
        v_seller_id,
        'auction_no_result',
        p_listing_id,
        'Auksjonen nådde ikke kravet'
      );
    end if;

    if v_top_bidder is not null then
      select n.id
        into v_existing
      from public.notifications n
      where n.user_id = v_top_bidder
        and n.type = 'auction_no_result'
        and n.listing_id = p_listing_id
      limit 1;

      if v_existing is null then
        insert into public.notifications (user_id, type, listing_id, message)
        values (
          v_top_bidder,
          'auction_no_result',
          p_listing_id,
          'Budet ditt var ikke høyt nok'
        );
      end if;
    end if;
  end if;
end;
$$;

revoke all on function public.create_post_auction_notifications_for_resolved_auction(uuid)
  from public;

grant execute on function public.create_post_auction_notifications_for_resolved_auction(uuid)
  to authenticated;
