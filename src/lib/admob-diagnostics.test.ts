import { describe, expect, it } from "vitest";
import {
  GOOGLE_TEST_REWARDED_AD_UNIT_ID,
  describeLoadAdErrorCode,
  detectPlatform,
  parseAdError,
  pickAdUnitId,
} from "./admob-diagnostics";

const REAL = "ca-app-pub-8449241346087567/5833691810";

describe("pickAdUnitId", () => {
  it("uses Google's test unit during development", () => {
    expect(pickAdUnitId(REAL, true)).toBe(GOOGLE_TEST_REWARDED_AD_UNIT_ID);
  });
  it("uses the owner's real unit in production", () => {
    expect(pickAdUnitId(REAL, false)).toBe(REAL);
  });
});

describe("detectPlatform", () => {
  it("is web in a normal browser (no native ad SDK possible)", () => {
    expect(detectPlatform({})).toBe("web");
  });
  it("detects the Android app shell", () => {
    expect(detectPlatform({ Capacitor: { getPlatform: () => "android" } })).toBe("android");
  });
});

describe("parseAdError", () => {
  it("reads LoadAdError code, domain, message and ResponseInfo", () => {
    const p = parseAdError({
      code: 3,
      domain: "com.google.android.gms.ads",
      message: "No fill.",
      responseInfo: { responseId: "abc" },
    });
    expect(p).toEqual({
      code: 3,
      domain: "com.google.android.gms.ads",
      message: "No fill.",
      responseInfo: { responseId: "abc" },
    });
  });
  it("reads a numeric code given as a string", () => {
    expect(parseAdError({ code: "8", message: "x" }).code).toBe(8);
  });
});

describe("describeLoadAdErrorCode", () => {
  it("names NO_FILL (3)", () => {
    expect(describeLoadAdErrorCode(3).name).toBe("ERROR_CODE_NO_FILL");
  });
  it("names APP_ID_MISSING (8)", () => {
    expect(describeLoadAdErrorCode(8).name).toBe("ERROR_CODE_APP_ID_MISSING");
  });
});
