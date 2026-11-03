/**
 * Pure AdMob diagnostics helpers (no browser or network access), so the rules
 * for platform detection, test-vs-real ad units and error explanations stay
 * testable. Used by src/lib/rewarded-ad.ts.
 */

export type AdPlatform = "web" | "android" | "ios";

/** Google's public sample rewarded unit — serves test ads only, never pays and never sends SSV to us. */
export const GOOGLE_TEST_REWARDED_AD_UNIT_ID = "ca-app-pub-3940256099942544/5224354917";

export type AdDiagnostic = {
  at: string;
  stage:
    | "no-ad-unit"
    | "invalid-ad-unit"
    | "no-sdk"
    | "initialize"
    | "load"
    | "show"
    | "cancelled"
    | "shown";
  platform: AdPlatform;
  testMode: boolean;
  adUnitId: string | null;
  code: number | null;
  codeName: string | null;
  domain: string | null;
  message: string;
  /** Human explanation (Arabic) of the cause and what to do. */
  explanation: string;
  responseInfo: unknown;
};

type WindowLike = {
  Capacitor?: {
    getPlatform?: () => string;
    isNativePlatform?: () => boolean;
  };
};

export function detectPlatform(w: WindowLike | null | undefined): AdPlatform {
  const cap = w?.Capacitor;
  if (!cap) return "web";
  const p = cap.getPlatform?.();
  if (p === "android" || p === "ios") return p;
  if (cap.isNativePlatform?.()) return "android";
  return "web";
}

/** Development builds always use Google's test unit; production uses the owner's real unit. */
export function pickAdUnitId(realAdUnitId: string, testMode: boolean): string {
  return testMode ? GOOGLE_TEST_REWARDED_AD_UNIT_ID : realAdUnitId;
}

/** Google Mobile Ads LoadAdError codes (Android numbering; iOS GADErrorCode shares 0-3, 8, 9, 11). */
const LOAD_AD_ERROR_CODES: Record<number, { name: string; explanation: string }> = {
  0: {
    name: "ERROR_CODE_INTERNAL_ERROR",
    explanation: "خطأ داخلي في خدمة الإعلانات (غالباً من خوادم Google). أعد المحاولة بعد قليل.",
  },
  1: {
    name: "ERROR_CODE_INVALID_REQUEST",
    explanation:
      "طلب الإعلان غير صالح: معرّف الوحدة خاطئ أو لا يخص هذا التطبيق، أو معرّف تطبيق AdMob في AndroidManifest لا يطابق الحساب.",
  },
  2: {
    name: "ERROR_CODE_NETWORK_ERROR",
    explanation: "تعذّر الاتصال بخوادم الإعلانات. تحقق من الإنترنت ومن صلاحية INTERNET في التطبيق.",
  },
  3: {
    name: "ERROR_CODE_NO_FILL",
    explanation:
      "لا يوجد إعلان متاح الآن لهذا الجهاز/البلد. شائع للوحدات الجديدة (حتى 24-48 ساعة) أو لحساب AdMob غير المعتمد بعد. جرّب لاحقاً أو استخدم الإعلانات التجريبية.",
  },
  8: {
    name: "ERROR_CODE_APP_ID_MISSING",
    explanation:
      "معرّف تطبيق AdMob غير موجود في AndroidManifest.xml (com.google.android.gms.ads.APPLICATION_ID).",
  },
  9: {
    name: "ERROR_CODE_MEDIATION_NO_FILL",
    explanation: "لم تُرجع أي شبكة وساطة إعلاناً. جرّب لاحقاً.",
  },
  10: {
    name: "ERROR_CODE_REQUEST_ID_MISMATCH",
    explanation: "عدم تطابق معرّف الطلب. أعد تحميل الإعلان.",
  },
  11: {
    name: "ERROR_CODE_INVALID_AD_STRING",
    explanation: "استجابة إعلان غير صالحة. أعد المحاولة.",
  },
};

export function describeLoadAdErrorCode(code: number | null | undefined): { name: string; explanation: string } {
  if (code === null || code === undefined || Number.isNaN(code)) {
    return { name: "UNKNOWN", explanation: "سبب غير معروف من مكتبة الإعلانات. راجع الرسالة التفصيلية." };
  }
  return (
    LOAD_AD_ERROR_CODES[code] ?? {
      name: `CODE_${code}`,
      explanation: "رمز خطأ غير موثّق من مكتبة الإعلانات. راجع الرسالة التفصيلية.",
    }
  );
}

/** Extracts code/domain/message/ResponseInfo from whatever the native bridge throws or emits. */
export function parseAdError(e: unknown): {
  code: number | null;
  domain: string | null;
  message: string;
  responseInfo: unknown;
} {
  if (e === null || e === undefined) return { code: null, domain: null, message: "", responseInfo: null };
  if (typeof e === "string") return { code: null, domain: null, message: e, responseInfo: null };
  const o = e as Record<string, unknown>;
  const data = (o.data && typeof o.data === "object" ? o.data : {}) as Record<string, unknown>;
  const rawCode = o.code ?? data.code ?? o.errorCode;
  const n = typeof rawCode === "number" ? rawCode : typeof rawCode === "string" ? Number(rawCode) : NaN;
  const message =
    (typeof o.message === "string" && o.message) ||
    (typeof data.message === "string" && data.message) ||
    (typeof o.errorMessage === "string" && o.errorMessage) ||
    String(e);
  return {
    code: Number.isFinite(n) ? n : null,
    domain: (typeof o.domain === "string" ? o.domain : typeof data.domain === "string" ? data.domain : null) ?? null,
    message,
    responseInfo: o.responseInfo ?? data.responseInfo ?? o.response_info ?? null,
  };
}

/** Why there is no ad SDK on this device. */
export function explainNoSdk(platform: AdPlatform): string {
  if (platform === "web") {
    return "التطبيق مفتوح من متصفح الإنترنت. إعلانات AdMob بمكافأة لا تعمل في المتصفح إطلاقاً؛ تعمل فقط داخل تطبيق Android/iOS مثبّت يحتوي على Google Mobile Ads SDK.";
  }
  return "التطبيق يعمل كتطبيق هاتف لكن إضافة AdMob غير مثبّتة فيه (@capacitor-community/admob). ثبّتها وأعد بناء التطبيق.";
}
