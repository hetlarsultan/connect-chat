import { describe, expect, it } from "vitest";
import { webcrypto, generateKeyPairSync, createSign } from "node:crypto";
import { isExpectedAdUnit, verifySsvQuery, type VerifierKey } from "./ssv-verify";

// Node DER-signs by default — the same format AdMob uses.
const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const keyId = "3335741209";
const keys: VerifierKey[] = [
  { keyId: Number(keyId), base64: publicKey.export({ type: "spki", format: "der" }).toString("base64") },
];

function sign(message: string) {
  const s = createSign("SHA256");
  s.update(message);
  return s.sign(privateKey).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// AdMob's "Verify URL" test callback shape.
const testMsg =
  "ad_network=5450213213286189855&ad_unit=1234567890&reward_amount=1&reward_item=Reward&timestamp=1700000000000&transaction_id=123456789";

if (!globalThis.crypto) (globalThis as unknown as { crypto: unknown }).crypto = webcrypto;

describe("verifySsvQuery", () => {
  it("accepts a correctly signed AdMob callback", async () => {
    const q = `${testMsg}&signature=${sign(testMsg)}&key_id=${keyId}`;
    expect(await verifySsvQuery(q, keys)).toBe("valid");
  });

  it("accepts a signature made over the decoded form of encoded values", async () => {
    const decoded = "ad_unit=5833691810&reward_item=Gold Coins&transaction_id=abc";
    const q = `ad_unit=5833691810&reward_item=Gold%20Coins&transaction_id=abc&signature=${sign(decoded)}&key_id=${keyId}`;
    expect(await verifySsvQuery(q, keys)).toBe("valid");
  });

  it("rejects a tampered callback", async () => {
    const q = `${testMsg.replace("reward_amount=1", "reward_amount=999")}&signature=${sign(testMsg)}&key_id=${keyId}`;
    expect(await verifySsvQuery(q, keys)).toBe("invalid");
  });

  it("reports an unknown key id", async () => {
    const q = `${testMsg}&signature=${sign(testMsg)}&key_id=1`;
    expect(await verifySsvQuery(q, keys)).toBe("unknown_key");
  });
});

describe("isExpectedAdUnit", () => {
  it("matches the numeric part of the configured unit", () => {
    expect(isExpectedAdUnit("5833691810", "ca-app-pub-8449241346087567/5833691810")).toBe(true);
  });
  it("flags AdMob's test unit 1234567890 as not the configured unit", () => {
    expect(isExpectedAdUnit("1234567890", "ca-app-pub-8449241346087567/5833691810")).toBe(false);
  });
});
