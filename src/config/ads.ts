/**
 * Ad configuration.
 *
 * The rewarded ad unit id is NOT hardcoded here — it is stored in the app's
 * own settings (table `ad_settings`) and can only be changed by the owner
 * from the owner dashboard. See src/lib/ad-settings.ts.
 *
 * SSV settings stay separate from the ad unit id and are unchanged.
 */

/** Path the ad network calls after a completed view. */
export const SSV_PATH = "/api/public/ads/ssv";

/** Stable public URL to paste into the ad network's SSV setting. */
export const SSV_CALLBACK_URL =
  `https://project--51264dbf-e956-4d43-bb85-2c36be6600e4.lovable.app${SSV_PATH}`;

/** AdMob ad unit id format: ca-app-pub-<16 digits>/<10 digits>. */
export const AD_UNIT_ID_PATTERN = /^ca-app-pub-\d{16}\/\d{6,12}$/;

export function isValidAdUnitId(value: string): boolean {
  return AD_UNIT_ID_PATTERN.test(value.trim());
}

/** Masked form for display: ca-app-pub-****4567/****1810 */
export function maskAdUnitId(value: string | null | undefined): string {
  if (!value) return "غير مضبوط";
  const [pub, unit] = value.split("/");
  if (!unit) return "********";
  return `ca-app-pub-****${(pub ?? "").slice(-4)}/****${unit.slice(-4)}`;
}
