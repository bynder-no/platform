"use client";

import { useActionState } from "react";

import { updateProfile } from "./actions";

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";

const buttonClass =
  "rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

type ProfileEditFormProps = {
  defaultDisplayName: string;
  defaultUsername: string;
  defaultShopName: string;
};

export function ProfileEditForm({
  defaultDisplayName,
  defaultUsername,
  defaultShopName,
}: ProfileEditFormProps) {
  const [state, formAction, pending] = useActionState(updateProfile, null);

  return (
    <form action={formAction} className="mt-10 flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          Display name
        </span>
        <input
          type="text"
          name="display_name"
          autoComplete="name"
          defaultValue={defaultDisplayName}
          className={inputClass}
          placeholder="How you want to appear"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          Username
        </span>
        <input
          type="text"
          name="username"
          autoComplete="username"
          defaultValue={defaultUsername}
          className={inputClass}
          placeholder="Public profile URL (optional)"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          Butikknavn
        </span>
        <input
          type="text"
          name="shop_name"
          defaultValue={defaultShopName}
          className={inputClass}
          placeholder="F.eks. Mikkels Pokeshop"
        />
      </label>

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Save"}
      </button>

      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
    </form>
  );
}
