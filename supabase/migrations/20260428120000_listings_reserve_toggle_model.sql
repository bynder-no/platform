alter table public.listings
add column if not exists reserve_price_nok integer null;

alter table public.listings
add column if not exists contact_threshold_percent integer null;

alter table public.listings
add column if not exists min_bid_increment_nok integer null;

alter table public.listings
add column if not exists use_reserve_price boolean not null default true;
