/**
 * Ad settings stored in the app's database (owner-editable only).
 *
 * Reads are allowed for signed-in users so the app can request the right ad
 * unit. Writes are restricted to the app owner (admin role) by RLS — a normal
 * user cannot change the ad unit id or turn ads on/off.
 */

import { supabase } from "@/integrations/supabase/client";
import { isValidAdUnitId } from "@/config/ads";

export type AdSettings = {
  rewarded_ad_unit_id: string | null;
  ads_enabled: boolean;
  rewarded_enabled: boolean;
  updated_at: string | null;
};

const CACHE_KEY = "ad_settings_cache_v1";
const CACHE_TTL = 60_000;

let memo: { at: number; value: AdSettings } | null = null;

function readCache(): AdSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as AdSettings) : null;
  } catch {
    return null;
  }
}

function writeCache(v: AdSettings) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

/** Latest settings from the database (cached briefly, cache used for instant paint). */
export async function fetchAdSettings(force = false): Promise<AdSettings | null> {
  if (!force && memo && Date.now() - memo.at < CACHE_TTL) return memo.value;
  const { data, error } = await supabase
    .from("ad_settings")
    .select("rewarded_ad_unit_id,ads_enabled,rewarded_enabled,updated_at")
    .maybeSingle();
  if (error || !data) return memo?.value ?? readCache();
  const value: AdSettings = {
    rewarded_ad_unit_id: data.rewarded_ad_unit_id ?? null,
    ads_enabled: Boolean(data.ads_enabled),
    rewarded_enabled: Boolean(data.rewarded_enabled),
    updated_at: data.updated_at ?? null,
  };
  memo = { at: Date.now(), value };
  writeCache(value);
  return value;
}

export function cachedAdSettings(): AdSettings | null {
  return memo?.value ?? readCache();
}

/** Owner-only save. RLS rejects the write for anyone without the admin role. */
export async function saveAdSettings(input: {
  rewarded_ad_unit_id: string | null;
  ads_enabled: boolean;
  rewarded_enabled: boolean;
  userId: string;
}): Promise<{ ok: true } | { ok: false; reason: "invalid" | "denied" }> {
  const id = input.rewarded_ad_unit_id?.trim() || null;
  if (id && !isValidAdUnitId(id)) return { ok: false, reason: "invalid" };

  const { error } = await supabase
    .from("ad_settings")
    .upsert(
      {
        id: true,
        rewarded_ad_unit_id: id,
        ads_enabled: input.ads_enabled,
        rewarded_enabled: input.rewarded_enabled,
        updated_by: input.userId,
      },
      { onConflict: "id" },
    );
  if (error) return { ok: false, reason: "denied" };
  memo = null;
  await fetchAdSettings(true);
  return { ok: true };
}

/** Records an ad loading failure so the owner can diagnose it later. */
export async function logAdError(opts: {
  userId: string | null;
  adUnitId: string | null;
  stage: string;
  message?: string;
}) {
  console.warn("[ads]", opts.stage, opts.message ?? "", opts.adUnitId ?? "");
  if (!opts.userId) return;
  try {
    await supabase.from("ad_error_logs").insert({
      user_id: opts.userId,
      ad_unit_id: opts.adUnitId,
      stage: opts.stage,
      message: opts.message ?? null,
    });
  } catch {
    /* logging must never break the app */
  }
}
