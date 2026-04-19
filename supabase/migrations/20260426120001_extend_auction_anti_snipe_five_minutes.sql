-- Anti-snipe: if remaining time is under 5 minutes when a bid is accepted, set end to now() + 5 minutes.
-- Replaces prior 2-minute window with 5-minute reset-from-bid-time behavior.
create or replace function public.extend_auction_anti_snipe(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window interval := interval '5 minutes';
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
        and b.created_at > v_now - interval '5 minutes'
    );
end;
$$;
