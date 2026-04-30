create table public.conversation_threads (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_low_id uuid generated always as (least(requester_id, recipient_id)) stored,
  user_high_id uuid generated always as (greatest(requester_id, recipient_id)) stored,
  constraint conversation_threads_no_self check (requester_id <> recipient_id),
  constraint conversation_threads_unique_pair unique (user_low_id, user_high_id)
);

create index conversation_threads_requester_idx
  on public.conversation_threads (requester_id, updated_at desc);

create index conversation_threads_recipient_idx
  on public.conversation_threads (recipient_id, updated_at desc);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.conversation_threads (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index conversation_messages_thread_created_idx
  on public.conversation_messages (thread_id, created_at asc);

create index conversation_messages_sender_idx
  on public.conversation_messages (sender_id, created_at desc);

create or replace function public.set_conversation_threads_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_set_conversation_threads_updated_at
before update on public.conversation_threads
for each row
execute function public.set_conversation_threads_updated_at();

create or replace function public.touch_conversation_thread_updated_at()
returns trigger
language plpgsql
as $$
begin
  update public.conversation_threads
    set updated_at = now()
  where id = new.thread_id;
  return new;
end;
$$;

create trigger trg_touch_conversation_thread_updated_at
after insert on public.conversation_messages
for each row
execute function public.touch_conversation_thread_updated_at();

alter table public.conversation_threads enable row level security;
alter table public.conversation_messages enable row level security;

create policy "Participants can view conversation threads"
  on public.conversation_threads
  for select
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = recipient_id);

create policy "Requester can create pending thread"
  on public.conversation_threads
  for insert
  to authenticated
  with check (
    auth.uid() = requester_id
    and requester_id <> recipient_id
    and status = 'pending'
  );

create policy "Recipient can update request status"
  on public.conversation_threads
  for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

create policy "Participants can view conversation messages"
  on public.conversation_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.conversation_threads t
      where t.id = conversation_messages.thread_id
        and (t.requester_id = auth.uid() or t.recipient_id = auth.uid())
    )
  );

create policy "Participants can send allowed conversation messages"
  on public.conversation_messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.conversation_threads t
      where t.id = conversation_messages.thread_id
        and (
          (
            t.status = 'accepted'
            and (t.requester_id = auth.uid() or t.recipient_id = auth.uid())
          )
          or (
            t.status = 'pending'
            and t.requester_id = auth.uid()
          )
        )
    )
  );
