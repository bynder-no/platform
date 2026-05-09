"use client";

import { useActionState } from "react";

import { updateProfile } from "./actions";

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50";

const buttonClass =
  "rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

type ProfileEditFormProps = {
  defaultUsername: string;
  defaultShopName: string;
  defaultActiveTitle: string;
};

export function ProfileEditForm({
  defaultUsername,
  defaultShopName,
  defaultActiveTitle,
}: ProfileEditFormProps) {
  const [state, formAction, pending] = useActionState(updateProfile, null);

  return (
    <form action={formAction} className="mt-10 flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          Brukernavn
        </span>
        <input
          type="text"
          name="username"
          autoComplete="username"
          defaultValue={defaultUsername}
          className={inputClass}
          placeholder="Offentlig profil (/u/…)"
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

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          Tittel
        </span>
        <select
          name="active_title"
          defaultValue={defaultActiveTitle}
          className={inputClass}
        >
          <option value="Kortselger">Kortselger</option>
          <option value="Pålitelig selger">Pålitelig selger</option>
          <option value="Slab-spesialist">Slab-spesialist</option>
          <option value="Sealed-samler">Sealed-samler</option>
          <option value="Toppratet">Toppratet</option>
        </select>
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
