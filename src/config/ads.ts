/**
 * Rewarded-ad configuration.
 *
 * The ad unit id is a public identifier (it ships inside the app on every
 * platform), so it is safe in code. An env override stays supported so the id
 * can be swapped without a code change.
 */

const FALLBACK_REWARDED_AD_UNIT_ID = "ca-app-pub-8449241346087567/5833691810";

export const REWARDED_AD_UNIT_ID: string =
  (import.meta.env["VITE_REWARDED_AD_UNIT_ID"] as string | undefined) || FALLBACK_REWARDED_AD_UNIT_ID;

/** Stable production path the ad network calls after a completed view. */
export const SSV_PATH = "/api/public/ads/ssv";
