-- Notifications v1 chat support: allow chat-thread notifications and links.

alter table public.notifications
  alter column listing_id drop not null;

alter table public.notifications
  add column if not exists thread_id uuid references public.conversation_threads (id) on delete cascade;

drop index if exists notifications_unique_event_idx;

create unique index if not exists notifications_unique_event_idx
  on public.notifications (user_id, type, listing_id, message, thread_id);

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'outbid',
      'seller_bid_received',
      'fixed_price_offer',
      'deal_action_required',
      'deal_requires_action',
      'deal_relevant',
      'won_auction',
      'auction_no_result',
      'no_successful_result',
      'rating_available',
      'message_request',
      'new_message'
    )
  );

create or replace function public.create_chat_notification(
  p_user_id uuid,
  p_type text,
  p_thread_id uuid,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_requester uuid;
  v_recipient uuid;
  v_existing_unread_id uuid;
  v_notification_id uuid;
begin
  v_actor := auth.uid();
  if v_actor is null then
    return null;
  end if;

  if p_user_id is null or p_thread_id is null then
    return null;
  end if;

  if p_message is null or btrim(p_message) = '' then
    return null;
  end if;

  if p_type not in ('message_request', 'new_message') then
    return null;
  end if;

  select t.requester_id, t.recipient_id
    into v_requester, v_recipient
  from public.conversation_threads t
  where t.id = p_thread_id;

  if v_requester is null or v_recipient is null then
    return null;
  end if;

  if v_actor <> v_requester and v_actor <> v_recipient then
    return null;
  end if;

  if p_user_id <> v_requester and p_user_id <> v_recipient then
    return null;
  end if;

  if p_user_id = v_actor then
    return null;
  end if;

  select n.id
    into v_existing_unread_id
  from public.notifications n
  where n.user_id = p_user_id
    and n.type = p_type
    and n.thread_id = p_thread_id
    and n.is_read = false
  order by n.created_at desc
  limit 1;

  if v_existing_unread_id is not null then
    return v_existing_unread_id;
  end if;

  insert into public.notifications (user_id, type, listing_id, thread_id, message)
  values (p_user_id, p_type, null, p_thread_id, p_message)
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

revoke all on function public.create_chat_notification(uuid, text, uuid, text) from public;
grant execute on function public.create_chat_notification(uuid, text, uuid, text) to authenticated;
