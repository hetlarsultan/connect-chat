/**
 * Rewarded-ad bridge.
 *
 * The reward itself is NEVER granted here — this only plays the ad the user
 * chose to watch. Crediting happens server-side after the ad network calls the
 * SSV endpoint (/api/public/ads/ssv).
 *
 * The ad unit id is always supplied by the caller from the owner-managed app
 * settings — it is never hardcoded here.
 *
 * A local mock mode is available to exercise the full flow (ad → SSV result)
 * without real ads. Mock runs are simulated only: they never touch the
 * database, the wallet, or any user data.
 */

import { isValidAdUnitId } from "@/config/ads";

type AdMobBridge = {
  prepareRewardVideoAd?: (opts: { adId: string; ssv?: { userId: string; customData?: string } }) => Promise<unknown>;
  showRewardVideoAd?: () => Promise<unknown>;
};

function getBridge(): AdMobBridge | null {
  const w = window as unknown as { AdMob?: AdMobBridge; admob?: AdMobBridge };
  return w.AdMob ?? w.admob ?? null;
}

/** Is a rewarded ad playable right now with this ad unit id? */
export function isRewardedAdAvailable(adUnitId?: string | null): boolean {
  const bridge = getBridge();
  return Boolean(bridge?.showRewardVideoAd && adUnitId && isValidAdUnitId(adUnitId));
}

/* ------------------------------ mock mode ------------------------------ */

const MOCK_KEY = "ads_mock_mode_v1";

export function isMockMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(MOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMockMode(on: boolean) {
  try {
    if (on) localStorage.setItem(MOCK_KEY, "1");
    else localStorage.removeItem(MOCK_KEY);
  } catch {
    /* ignore */
  }
}

export type MockOutcome = "verified" | "failed" | "cancelled";

export type ShowResult = {
  shown: boolean;
  reason?: "unavailable" | "failed" | "cancelled" | "no-ad-unit" | "invalid-ad-unit" | "disabled";
  message?: string;
};

/** Simulated ad playback + SSV result. No network, no DB writes. */
export async function runMockFlow(outcome: MockOutcome): Promise<{ result: ShowResult }> {
  await new Promise((r) => setTimeout(r, 900));
  if (outcome === "cancelled") return { result: { shown: false, reason: "cancelled" } };
  return { result: { shown: true } };
}

/** Plays the rewarded ad, passing the user id + transaction id to the network for SSV. */
export async function showRewardedAd(
  userId: string,
  transactionId: string,
  adUnitId: string | null | undefined,
): Promise<ShowResult> {
  const adId = adUnitId?.trim() || "";
  // No ad unit configured => never attempt to load an ad.
  if (!adId) return { shown: false, reason: "no-ad-unit" };
  if (!isValidAdUnitId(adId)) return { shown: false, reason: "invalid-ad-unit" };

  const bridge = getBridge();
  if (!bridge?.showRewardVideoAd) return { shown: false, reason: "unavailable" };

  try {
    await bridge.prepareRewardVideoAd?.({ adId, ssv: { userId, customData: transactionId } });
    const res = (await bridge.showRewardVideoAd()) as { rewarded?: boolean; dismissed?: boolean } | undefined;
    if (res && res.rewarded === false) return { shown: false, reason: "cancelled" };
    return { shown: true };
  } catch (e) {
    return { shown: false, reason: "failed", message: e instanceof Error ? e.message : String(e) };
  }
}
