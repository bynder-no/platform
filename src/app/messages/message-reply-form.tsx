"use client";

import { useActionState } from "react";

import { replyToMessage } from "./actions";

const inputClass =
  "min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";

const buttonClass =
  "shrink-0 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

type MessageReplyFormProps = {
  parentMessageId: string;
};

export function MessageReplyForm({ parentMessageId }: MessageReplyFormProps) {
  const [state, formAction, pending] = useActionState(replyToMessage, null);

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="parent_message_id" value={parentMessageId} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <textarea
          name="body"
          rows={2}
          required
          aria-label="Reply"
          className={inputClass}
          placeholder="Reply…"
        />
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "…" : "Reply"}
        </button>
      </div>
      {state?.error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
    </form>
  );
}
