-- Fix: UPDATE matched 0 rows when transaction_stats_recorded was NULL (NULL = false is unknown in SQL).
-- Fix: RLS is evaluated for the session user; allow this SECURITY DEFINER body to update rows.
-- Temporary: RAISE NOTICE lines for Postgres logs (remove when done debugging).
create or replace function public.apply_listing_deal_transaction_stats(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller_id uuid;
  v_bidder_id uuid;
  v_rows int;
  v_match_count bigint;
  v_row_exists boolean;
begin
  perform set_config('row_security', 'off', true);

  raise notice 'apply_listing_deal_transaction_stats p_listing_id=%', p_listing_id;

  if auth.uid() is null then
    raise notice 'apply_listing_deal_transaction_stats: early exit auth.uid() is null';
    return;
  end if;

  select exists (
    select 1 from public.listing_deals ld where ld.listing_id = p_listing_id
  ) into v_row_exists;
  raise notice 'apply_listing_deal_transaction_stats listing_deals row exists=%', v_row_exists;

  select l.seller_id into v_seller_id
  from public.listings l
  where l.id = p_listing_id;

  select b.bidder_id into v_bidder_id
  from public.bids b
  where b.listing_id = p_listing_id
  order by b.amount_nok desc nulls last, b.created_at desc nulls last
  limit 1;

  if v_seller_id is null or v_bidder_id is null then
    raise notice 'apply_listing_deal_transaction_stats: early exit missing seller_id or bidder_id';
    return;
  end if;

  if auth.uid() <> v_seller_id and auth.uid() <> v_bidder_id then
    raise notice 'apply_listing_deal_transaction_stats: early exit caller not seller or winning bidder';
    return;
  end if;

  select count(*) into v_match_count
  from public.listing_deals ld
  where ld.listing_id = p_listing_id
    and ld.seller_decision = 'deal'
    and ld.bidder_decision = 'deal'
    and (ld.transaction_stats_recorded is not true);

  raise notice 'apply_listing_deal_transaction_stats rows matching UPDATE predicate (before UPDATE)=%', v_match_count;

  update public.listing_deals ld
  set transaction_stats_recorded = true
  where ld.listing_id = p_listing_id
    and ld.seller_decision = 'deal'
    and ld.bidder_decision = 'deal'
    and (ld.transaction_stats_recorded is not true);

  get diagnostics v_rows = row_count;
  raise notice 'apply_listing_deal_transaction_stats UPDATE row_count=%', v_rows;

  if v_rows = 0 then
    return;
  end if;

  update public.profiles
  set sales_count = coalesce(sales_count, 0) + 1
  where id = v_seller_id;

  update public.profiles
  set purchases_count = coalesce(purchases_count, 0) + 1
  where id = v_bidder_id;
end;
$$;

revoke all on function public.apply_listing_deal_transaction_stats(uuid) from public;
grant execute on function public.apply_listing_deal_transaction_stats(uuid) to authenticated;
