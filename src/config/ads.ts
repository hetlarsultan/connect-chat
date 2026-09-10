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

/** Path the ad network calls after a completed view. */
export const SSV_PATH = "/api/public/ads/ssv";

/** Stable public URL to paste into the ad network's SSV setting. */
export const SSV_CALLBACK_URL =
  `https://project--51264dbf-e956-4d43-bb85-2c36be6600e4.lovable.app${SSV_PATH}`;
