/**
 * Rewarded-ad bridge.
 *
 * The reward itself is NEVER granted here — this only plays the ad the user
 * chose to watch. Crediting happens server-side after the ad network calls the
 * SSV endpoint (/api/public/ads/ssv).
 */

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
  return Boolean(bridge?.showRewardVideoAd && import.meta.env["VITE_REWARDED_AD_UNIT_ID"]);
}

export type ShowResult = { shown: boolean; reason?: string };

/** Plays the rewarded ad, passing the user id + transaction id to the network for SSV. */
export async function showRewardedAd(userId: string, transactionId: string): Promise<ShowResult> {
  const bridge = getBridge();
  const adId = import.meta.env["VITE_REWARDED_AD_UNIT_ID"] as string | undefined;
  if (!bridge?.showRewardVideoAd || !adId) {
    return { shown: false, reason: "unavailable" };
  }
  try {
    await bridge.prepareRewardVideoAd?.({ adId, ssv: { userId, customData: transactionId } });
    await bridge.showRewardVideoAd();
    return { shown: true };
  } catch {
    return { shown: false, reason: "failed" };
  }
}
