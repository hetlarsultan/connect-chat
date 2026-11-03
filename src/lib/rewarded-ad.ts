/**
 * Rewarded-ad bridge.
 *
 * The reward itself is NEVER granted here — this only plays the ad the user
 * chose to watch. Crediting happens server-side after the ad network calls the
 * SSV endpoint (/api/public/ads/ssv).
 *
 * The ad unit id is always supplied by the caller from the owner-managed app
 * settings — it is never hardcoded here. Development builds swap it for
 * Google's public test unit, so real ads only load in production builds.
 *
 * Works with the Capacitor plugin @capacitor-community/admob
 * (window.Capacitor.Plugins.AdMob) or any bridge exposing the same API on
 * window.AdMob. Every failure returns a detailed AdDiagnostic (LoadAdError
 * code/name, domain, message, ResponseInfo when the bridge provides it).
 *
 * A local mock mode is available to exercise the full flow (ad → SSV result)
 * without real ads. Mock runs are simulated only: they never touch the
 * database, the wallet, or any user data.
 */

import { isValidAdUnitId } from "@/config/ads";
import {
  describeLoadAdErrorCode,
  detectPlatform,
  explainNoSdk,
  parseAdError,
  pickAdUnitId,
  type AdDiagnostic,
} from "@/lib/admob-diagnostics";

type Listener = { remove: () => Promise<void> | void };

type AdMobBridge = {
  initialize?: (opts?: { initializeForTesting?: boolean; testingDevices?: string[] }) => Promise<unknown>;
  prepareRewardVideoAd?: (opts: {
    adId: string;
    isTesting?: boolean;
    ssv?: { userId: string; customData?: string };
  }) => Promise<unknown>;
  showRewardVideoAd?: () => Promise<unknown>;
  addListener?: (event: string, cb: (info: unknown) => void) => Promise<Listener> | Listener;
};

type AdWindow = {
  AdMob?: AdMobBridge;
  admob?: AdMobBridge;
  Capacitor?: {
    getPlatform?: () => string;
    isNativePlatform?: () => boolean;
    Plugins?: { AdMob?: AdMobBridge };
  };
};

function adWindow(): AdWindow | null {
  return typeof window === "undefined" ? null : (window as unknown as AdWindow);
}

function getBridge(): AdMobBridge | null {
  const w = adWindow();
  return w?.Capacitor?.Plugins?.AdMob ?? w?.AdMob ?? w?.admob ?? null;
}

/** Test ads during development (preview/dev server), real ads only in production builds. */
export function isTestAdsMode(): boolean {
  return Boolean(import.meta.env.DEV);
}

export function currentAdPlatform() {
  return detectPlatform(adWindow());
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
  diagnostic?: AdDiagnostic;
};

/** Simulated ad playback + SSV result. No network, no DB writes. */
export async function runMockFlow(outcome: MockOutcome): Promise<{ result: ShowResult }> {
  await new Promise((r) => setTimeout(r, 900));
  if (outcome === "cancelled") return { result: { shown: false, reason: "cancelled" } };
  return { result: { shown: true } };
}

/* --------------------------- SDK initialization --------------------------- */

let initPromise: Promise<void> | null = null;

function ensureInitialized(bridge: AdMobBridge, testMode: boolean): Promise<void> {
  if (!bridge.initialize) return Promise.resolve();
  if (!initPromise) {
    initPromise = Promise.resolve(bridge.initialize({ initializeForTesting: testMode })).then(() => undefined);
    // A failed init must be retried on the next attempt (retry button).
    initPromise.catch(() => {
      initPromise = null;
    });
  }
  return initPromise;
}

/** Forget a failed/stale SDK init so the next attempt starts clean. */
export function resetAdSdk() {
  initPromise = null;
}

function diag(partial: Partial<AdDiagnostic> & Pick<AdDiagnostic, "stage" | "explanation">): AdDiagnostic {
  return {
    at: new Date().toISOString(),
    platform: currentAdPlatform(),
    testMode: isTestAdsMode(),
    adUnitId: null,
    code: null,
    codeName: null,
    domain: null,
    message: "",
    responseInfo: null,
    ...partial,
  };
}

function fromError(stage: "initialize" | "load" | "show", e: unknown, adUnitId: string): AdDiagnostic {
  const p = parseAdError(e);
  const d = describeLoadAdErrorCode(p.code);
  const prefix =
    stage === "initialize"
      ? "فشلت تهيئة Google Mobile Ads SDK. "
      : stage === "show"
        ? "تم تحميل الإعلان لكن فشل عرضه. "
        : "";
  return diag({
    stage,
    adUnitId,
    code: p.code,
    codeName: p.code === null ? null : d.name,
    domain: p.domain,
    message: p.message,
    responseInfo: p.responseInfo,
    explanation: prefix + d.explanation,
  });
}

/** Plays the rewarded ad, passing the user id + transaction id to the network for SSV. */
export async function showRewardedAd(
  userId: string,
  transactionId: string,
  adUnitId: string | null | undefined,
): Promise<ShowResult> {
  const realId = adUnitId?.trim() || "";
  // No ad unit configured => never attempt to load an ad.
  if (!realId) {
    return {
      shown: false,
      reason: "no-ad-unit",
      diagnostic: diag({ stage: "no-ad-unit", explanation: "لم يضبط المالك معرّف الوحدة الإعلانية بعد." }),
    };
  }
  if (!isValidAdUnitId(realId)) {
    return {
      shown: false,
      reason: "invalid-ad-unit",
      diagnostic: diag({
        stage: "invalid-ad-unit",
        adUnitId: realId,
        explanation: "صيغة معرّف الوحدة الإعلانية غير صحيحة (المتوقع ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX).",
      }),
    };
  }

  const bridge = getBridge();
  if (!bridge?.showRewardVideoAd) {
    const platform = currentAdPlatform();
    return {
      shown: false,
      reason: "unavailable",
      diagnostic: diag({ stage: "no-sdk", adUnitId: realId, explanation: explainNoSdk(platform) }),
    };
  }

  const testMode = isTestAdsMode();
  const adId = pickAdUnitId(realId, testMode);

  try {
    await ensureInitialized(bridge, testMode);
  } catch (e) {
    return { shown: false, reason: "failed", diagnostic: fromError("initialize", e, adId) };
  }

  // Native SDKs report LoadAdError/ResponseInfo through events as well as promise rejections.
  let eventError: { stage: "load" | "show"; info: unknown } | null = null;
  const listeners: Listener[] = [];
  const listen = async (event: string, stage: "load" | "show") => {
    try {
      const l = await bridge.addListener?.(event, (info) => {
        eventError = { stage, info };
      });
      if (l) listeners.push(l);
    } catch {
      /* listener support is optional */
    }
  };
  await Promise.all([
    listen("onRewardedVideoAdFailedToLoad", "load"),
    listen("onRewardedVideoAdFailedToShow", "show"),
  ]);

  const cleanup = () => {
    for (const l of listeners) void Promise.resolve(l.remove()).catch(() => undefined);
  };

  try {
    try {
      await bridge.prepareRewardVideoAd?.({
        adId,
        isTesting: testMode,
        ssv: { userId, customData: transactionId },
      });
    } catch (e) {
      const ev = eventError as { info: unknown } | null;
      return { shown: false, reason: "failed", diagnostic: fromError("load", ev?.info ?? e, adId) };
    }
    let res: { rewarded?: boolean; dismissed?: boolean } | undefined;
    try {
      res = (await bridge.showRewardVideoAd()) as typeof res;
    } catch (e) {
      const ev = eventError as { info: unknown } | null;
      return { shown: false, reason: "failed", diagnostic: fromError("show", ev?.info ?? e, adId) };
    }
    if (res && res.rewarded === false) {
      return {
        shown: false,
        reason: "cancelled",
        diagnostic: diag({ stage: "cancelled", adUnitId: adId, explanation: "أُغلق الإعلان قبل اكتماله." }),
      };
    }
    return {
      shown: true,
      diagnostic: diag({
        stage: "shown",
        adUnitId: adId,
        explanation: testMode
          ? "عُرض إعلان تجريبي (نسخة تطوير). الإعلانات التجريبية لا تضيف رصيداً."
          : "عُرض الإعلان. الرصيد يُضاف فقط بعد وصول تحقق Google (SSV) إلى الخادم.",
      }),
    };
  } finally {
    cleanup();
  }
}
