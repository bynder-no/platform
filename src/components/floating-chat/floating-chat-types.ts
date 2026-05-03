export type ChatPreview = {
  id: string;
  otherName: string;
  preview: string;
  when: string;
  status: string;
  requesterId: string;
  recipientId: string;
  unreadCount: number;
  messages: Array<{
    id: string;
    senderId: string;
    body: string;
    createdAt: string | null;
  }>;
};

export type ChatPatch = Partial<ChatPreview> & {
  messages?: ChatPreview["messages"];
};
