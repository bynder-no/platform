/** Norwegian labels matching FINN-style delivery / seen hints for own messages. */

export function indexOfLatestOwnMessage<
  T extends { senderId: string },
>(messages: T[], currentUserId: string): number {
  const uid = String(currentUserId);
  for (let i = messages.length - 1; i >= 0; i--) {
    if (String(messages[i].senderId) === uid) return i;
  }
  return -1;
}

export function OutgoingDeliveryLabel({
  readAt,
}: {
  readAt: string | null | undefined;
}) {
  const label = readAt != null ? "Sett" : "Sendt";
  return (
    <span className="mt-0.5 block text-right text-xs text-zinc-400">{label}</span>
  );
}
