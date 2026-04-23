-- Ended auctions: always resolve pending → terminal (no stall on bids + contact without listing_deals yet).

create or replace function public.apply_listing_auction_outcome_if_pending(p_listing_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_ends timestamptz;
  v_stored text;
  v_use_reserve boolean;
  v_reserve numeric;
  v_pct numeric;
  v_bid_count int;
  v_high numeric;
  v_has_deal boolean;
  v_contact_unlocked boolean;
  v_next text;
begin
  select
    l.type,
    l.auction_ends_at,
    l.auction_outcome,
    l.use_reserve_price,
    l.reserve_price_nok,
    l.contact_threshold_percent
  into
    v_type,
    v_ends,
    v_stored,
    v_use_reserve,
    v_reserve,
    v_pct
  from public.listings l
  where l.id = p_listing_id;

  if not found then
    return null;
  end if;

  if v_type is distinct from 'auction' then
    return v_stored;
  end if;

  if v_stored is distinct from 'pending' then
    return v_stored;
  end if;

  if v_ends is null or now() < v_ends then
    return 'pending';
  end if;

  select exists (
    select 1
    from public.listing_deals d
    where d.listing_id = p_listing_id
  )
  into v_has_deal;

  select
    count(*)::int,
    coalesce(max(b.amount_nok::numeric), 0)
  into v_bid_count, v_high
  from public.bids b
  where b.listing_id = p_listing_id;

  if v_has_deal then
    v_next := 'deal_opened';
  elsif v_bid_count = 0 then
    v_next := 'no_bids';
  elsif not coalesce(v_use_reserve, false) then
    v_next := 'deal_opened';
  else
    if v_reserve is null or v_pct is null then
      v_contact_unlocked := false;
    else
      v_contact_unlocked :=
        v_high >= ceil((v_reserve * v_pct) / 100.0);
    end if;

    if not v_contact_unlocked then
      v_next := 'threshold_not_met';
    else
      v_next := 'deal_opened';
    end if;
  end if;

  update public.listings l
    set auction_outcome = v_next
  where l.id = p_listing_id
    and l.type = 'auction'
    and l.auction_outcome = 'pending';

  return v_next;
end;
$$;

revoke all on function public.apply_listing_auction_outcome_if_pending(uuid) from public;
grant execute on function public.apply_listing_auction_outcome_if_pending(uuid) to authenticated;
