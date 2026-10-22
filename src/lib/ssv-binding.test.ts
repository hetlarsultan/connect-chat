import { describe, expect, it } from "vitest";
import { resolveSsvBinding } from "./ssv-binding";
import { buildSsvCallbackUrl, SSV_CALLBACK_URL } from "@/config/ads";

const OWNER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

describe("SSV binding: reward goes only to the user who watched", () => {
  it("credits when user_id matches the owner of the custom_data view request", () => {
    expect(resolveSsvBinding({ customData: "req-1", claimedUserId: OWNER, requestOwnerId: OWNER })).toEqual({
      ok: true,
      userId: OWNER,
      requestId: "req-1",
    });
  });

  it("refuses when user_id belongs to a different user", () => {
    const r = resolveSsvBinding({ customData: "req-1", claimedUserId: OTHER, requestOwnerId: OWNER });
    expect(r).toEqual({ ok: false, reason: "user_mismatch", ownerId: OWNER });
  });

  it("refuses when user_id is missing", () => {
    const r = resolveSsvBinding({ customData: "req-1", claimedUserId: null, requestOwnerId: OWNER });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_user_id");
  });

  it("refuses when custom_data is missing", () => {
    const r = resolveSsvBinding({ customData: "", claimedUserId: OWNER, requestOwnerId: OWNER });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_custom_data");
  });

  it("refuses when no view request exists for custom_data", () => {
    const r = resolveSsvBinding({ customData: "req-x", claimedUserId: OWNER, requestOwnerId: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unknown_request");
  });
});

describe("SSV callback URL generation", () => {
  it("uses the current published domain", () => {
    expect(buildSsvCallbackUrl("https://connect-chat-liart.vercel.app")).toBe(
      "https://connect-chat-liart.vercel.app/api/public/ads/ssv",
    );
  });

  it("falls back to the stable public URL from the editor preview or localhost", () => {
    expect(buildSsvCallbackUrl("https://id-preview--abc.lovable.app")).toBe(SSV_CALLBACK_URL);
    expect(buildSsvCallbackUrl("http://localhost:8080")).toBe(SSV_CALLBACK_URL);
  });
});
