-- Allow multiple listing_deals rows per listing (different bidders).
-- Older schemas often had UNIQUE or PRIMARY KEY on listing_id alone; that blocks Buyer 2+.

do $$
declare
  con record;
  att name;
begin
  for con in
    select c.oid, c.conname, c.conkey
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public'
      and rel.relname = 'listing_deals'
      and c.contype = 'u'
  loop
    if array_length(con.conkey, 1) = 1 then
      select a.attname into att
      from pg_attribute a
      where a.attrelid = 'public.listing_deals'::regclass
        and a.attnum = con.conkey[1]
        and not a.attisdropped;

      if att = 'listing_id' then
        execute format(
          'alter table public.listing_deals drop constraint %I',
          con.conname
        );
      end if;
    end if;
  end loop;
end $$;

-- Unique indexes created without a named table constraint (CREATE UNIQUE INDEX ...).
do $$
declare
  idx record;
  cols text[];
begin
  for idx in
    select i.indexrelid::regclass::text as idx_name,
           i.indrelid,
           i.indkey
    from pg_index i
    join pg_class t on t.oid = i.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'listing_deals'
      and i.indisunique
      and not i.indisprimary
  loop
    select array_agg(a.attname order by ord)
      into cols
    from unnest(idx.indkey::smallint[]) with ordinality as u(attnum, ord)
    join pg_attribute a
      on a.attrelid = idx.indrelid
     and a.attnum = u.attnum
     and not a.attisdropped;

    if cols is not null and cardinality(cols) = 1 and cols[1] = 'listing_id' then
      execute format('drop index if exists %s', idx.idx_name);
    end if;
  end loop;
end $$;
