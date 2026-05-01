-- Allow marking inbound messages as read when a participant views a thread (RLS has no UPDATE on conversation_messages).

create or replace function public.mark_conversation_messages_read_for_viewer(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update public.conversation_messages m
  set read_at = now()
  where m.thread_id = p_thread_id
    and m.sender_id is distinct from auth.uid()
    and m.read_at is null
    and exists (
      select 1
      from public.conversation_threads t
      where t.id = m.thread_id
        and (t.requester_id = auth.uid() or t.recipient_id = auth.uid())
    );
end;
$$;

revoke all on function public.mark_conversation_messages_read_for_viewer(uuid) from public;
grant execute on function public.mark_conversation_messages_read_for_viewer(uuid) to authenticated;
