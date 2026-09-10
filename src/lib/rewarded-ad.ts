/**
 * Rewarded-ad bridge.
 *
 * The reward itself is NEVER granted here — this only plays the ad the user
 * chose to watch. Crediting happens server-side after the ad network calls the
 * SSV endpoint (/api/public/ads/ssv).
 *
 * A local mock mode is available to exercise the full flow (ad → SSV result)
 * without real ads. Mock runs are simulated only: they never touch the
 * database, the wallet, or any user data.
 */

import { REWARDED_AD_UNIT_ID } from "@/config/ads";

type AdMobBridge = {
  prepareRewardVideoAd?: (opts: { adId: string; ssv?: { userId: string; customData?: string } }) => Promise<unknown>;
  showRewardVideoAd?: () => Promise<unknown>;
};

function getBridge(): AdMobBridge | null {
  const w = window as unknown as { AdMob?: AdMobBridge; admob?: AdMobBridge };
  return w.AdMob ?? w.admob ?? null;
}

export function isRewardedAdAvailable(): boolean {
  const bridge = getBridge();
  return Boolean(bridge?.showRewardVideoAd && REWARDED_AD_UNIT_ID);
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

export type ShowResult = { shown: boolean; reason?: "unavailable" | "failed" | "cancelled" };

/** Simulated ad playback + SSV result. No network, no DB writes. */
export async function runMockFlow(outcome: MockOutcome): Promise<{ result: ShowResult }> {
  await new Promise((r) => setTimeout(r, 900));
  if (outcome === "cancelled") return { result: { shown: false, reason: "cancelled" } };
  return { result: { shown: true } };
}

/** Plays the rewarded ad, passing the user id + transaction id to the network for SSV. */
export async function showRewardedAd(userId: string, transactionId: string): Promise<ShowResult> {
  const bridge = getBridge();
  const adId = import.meta.env["VITE_REWARDED_AD_UNIT_ID"] as string | undefined;
  if (!bridge?.showRewardVideoAd || !adId) {
    return { shown: false, reason: "unavailable" };
  }
  try {
    await bridge.prepareRewardVideoAd?.({ adId, ssv: { userId, customData: transactionId } });
    const res = (await bridge.showRewardVideoAd()) as { rewarded?: boolean; dismissed?: boolean } | undefined;
    if (res && res.rewarded === false) return { shown: false, reason: "cancelled" };
    return { shown: true };
  } catch {
    return { shown: false, reason: "failed" };
  }
}
