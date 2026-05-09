"use server";

import { redirect } from "next/navigation";

import {
  ALLOWED_ACTIVE_TITLES,
  TITLE_KORTSELGER,
  TITLE_PALITELIG_SELGER,
  TITLE_SLAB_SPESIALIST,
  TITLE_SEALED_SAMLER,
  TITLE_TOPPRATET,
  type TitleUnlockMap,
} from "@/lib/profile-titles";
import { createClient } from "@/lib/supabase/server";
export type UpdateProfileState = { error: string } | null;

const USERNAME_TAKEN = "That username is already taken.";
export async function computeTitleUnlocks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<TitleUnlockMap> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("sales_count")
    .eq("id", userId)
    .maybeSingle();
  const salesCountRaw = Number(profile?.sales_count);
  const completedSales = Number.isFinite(salesCountRaw)
    ? Math.max(0, Math.trunc(salesCountRaw))
    : 0;

  const { count: slabCount } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", userId)
    .eq("category", "slab")
    .neq("status", "deleted");

  const { count: sealedCount } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", userId)
    .eq("category", "sealed")
    .neq("status", "deleted");

  const { data: ratingRows } = await supabase
    .from("deal_ratings")
    .select("score")
    .eq("to_user_id", userId);
  const scores = (ratingRows ?? [])
    .map((r) => Number(r.score))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
  const ratingCount = scores.length;
  const avgIsFive = ratingCount > 0 && scores.every((n) => n === 5);

  return {
    [TITLE_KORTSELGER]: true,
    [TITLE_PALITELIG_SELGER]: completedSales >= 5,
    [TITLE_SLAB_SPESIALIST]: (slabCount ?? 0) >= 3,
    [TITLE_SEALED_SAMLER]: (sealedCount ?? 0) >= 3,
    [TITLE_TOPPRATET]: avgIsFive && ratingCount >= 5,
  };
}

export async function updateProfile(
  _prev: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Optional; blank clears to null (same as the profile form).
  const usernameRaw = String(formData.get("username") ?? "");
  const username = usernameRaw.trim() || null;
  /** Mirror username into display_name for backward compatibility (single public name). */
  const display_name = username;
  const shopNameRaw = String(formData.get("shop_name") ?? "");
  const shop_name = shopNameRaw.trim() || null;
  const activeTitleRaw = String(formData.get("active_title") ?? "").trim();
  const requestedActiveTitle = ALLOWED_ACTIVE_TITLES.has(activeTitleRaw)
    ? activeTitleRaw
    : TITLE_KORTSELGER;

  if (username) {
    const { data: other, error: conflictError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .neq("id", user.id)
      .maybeSingle();

    if (conflictError) {
      return { error: conflictError.message };
    }

    if (other) {
      return { error: USERNAME_TAKEN };
    }
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("active_title")
    .eq("id", user.id)
    .maybeSingle();
  const currentActiveTitleRaw = String(currentProfile?.active_title ?? "").trim();
  const currentActiveTitle = ALLOWED_ACTIVE_TITLES.has(currentActiveTitleRaw)
    ? currentActiveTitleRaw
    : TITLE_KORTSELGER;
  const unlockedTitles = await computeTitleUnlocks(supabase, user.id);
  const active_title = unlockedTitles[requestedActiveTitle]
    ? requestedActiveTitle
    : currentActiveTitle;

  const { error } = await supabase
    .from("profiles")
    .update({ display_name, username, shop_name, active_title })
    .eq("id", user.id);

  if (error) {
    if (
      error.code === "23505" ||
      error.message.toLowerCase().includes("duplicate key")
    ) {
      return { error: USERNAME_TAKEN };
    }
    return { error: error.message };
  }

  redirect("/profile");
}
