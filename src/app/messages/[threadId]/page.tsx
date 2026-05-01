import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ threadId: string }>;
};

/** Fallback only: open thread in Chatter via home query param (handled client-side). */
export default async function MessageThreadFallbackRedirect({ params }: PageProps) {
  const { threadId } = await params;
  redirect(`/?chatThread=${encodeURIComponent(threadId)}`);
}
