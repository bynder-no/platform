-- Atomic, idempotent deal completion stats (seller sale + bidder purchase).
-- SECURITY DEFINER: callers cannot update the other party's profile under normal RLS.
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
begin
  if auth.uid() is null then
    return;
  end if;

  select l.seller_id into v_seller_id
  from public.listings l
  where l.id = p_listing_id;

  select b.bidder_id into v_bidder_id
  from public.bids b
  where b.listing_id = p_listing_id
  order by b.amount_nok desc nulls last, b.created_at desc nulls last
  limit 1;

  if v_seller_id is null or v_bidder_id is null then
    return;
  end if;

  if auth.uid() <> v_seller_id and auth.uid() <> v_bidder_id then
    return;
  end if;

  update public.listing_deals ld
  set transaction_stats_recorded = true
  where ld.listing_id = p_listing_id
    and ld.seller_decision = 'deal'
    and ld.bidder_decision = 'deal'
    and ld.transaction_stats_recorded = false;

  get diagnostics v_rows = row_count;
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
