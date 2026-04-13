-- Anti-snipe: extend auction end when a bid is placed in the final 2 minutes.
-- SECURITY DEFINER so bidders can update auction_ends_at without broad listing UPDATE policies.
-- Requires a bid from the caller in the last minute (placed just before this RPC).
create or replace function public.extend_auction_anti_snipe(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window interval := interval '2 minutes';
begin
  update public.listings l
  set auction_ends_at = v_now + v_window
  where l.id = p_listing_id
    and l.type = 'auction'
    and l.status = 'active'
    and l.auction_ends_at is not null
    and l.auction_ends_at > v_now
    and (l.auction_ends_at - v_now) < v_window
    and exists (
      select 1
      from public.bids b
      where b.listing_id = p_listing_id
        and b.bidder_id = auth.uid()
        and b.created_at > v_now - interval '1 minute'
    );
end;
$$;

revoke all on function public.extend_auction_anti_snipe(uuid) from public;
grant execute on function public.extend_auction_anti_snipe(uuid) to authenticated;
