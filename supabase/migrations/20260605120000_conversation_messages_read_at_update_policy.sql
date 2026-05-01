-- Optional complement to mark_conversation_messages_read_for_viewer RPC:
-- lets authenticated participants UPDATE inbound rows (sender_id <> viewer).
-- Column-level enforcement is not available in RLS; prefer the RPC for marking read.

create policy "Participants update inbound conversation messages"
on public.conversation_messages
for update
to authenticated
using (
  sender_id is distinct from auth.uid()
  and exists (
    select 1
    from public.conversation_threads t
    where t.id = conversation_messages.thread_id
      and (t.requester_id = auth.uid() or t.recipient_id = auth.uid())
  )
)
with check (
  sender_id is distinct from auth.uid()
  and exists (
    select 1
    from public.conversation_threads t
    where t.id = conversation_messages.thread_id
      and (t.requester_id = auth.uid() or t.recipient_id = auth.uid())
  )
);
