alter table public.listings
  add column type text not null default 'fixed_price'
    constraint listings_type_check check (type in ('fixed_price', 'auction'));
