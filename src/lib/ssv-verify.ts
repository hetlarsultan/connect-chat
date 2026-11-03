/**
 * Pure helpers for verifying Google AdMob SSV callbacks (ECDSA P-256 / SHA-256).
 * Kept free of network and database access so the rules are unit-testable.
 */

export type VerifierKey = { keyId: number | string; pem?: string; base64?: string };

export function b64ToBytes(b64: string): Uint8Array {
  const norm = b64.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, "");
  const padded = norm + "=".repeat((4 - (norm.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function keyToSpki(key: VerifierKey): Uint8Array {
  if (key.base64) return b64ToBytes(key.base64);
  const body = (key.pem ?? "").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return b64ToBytes(body);
}

/** DER ECDSA signature -> raw r||s (P-256, 32 bytes each) as WebCrypto expects. */
export function derToRaw(der: Uint8Array): Uint8Array {
  let i = 0;
  if (der[i++] !== 0x30) throw new Error("bad DER");
  if ((der[i] ?? 0) & 0x80) i += 1 + ((der[i] ?? 0) & 0x7f);
  else i += 1;
  const readInt = () => {
    if (der[i++] !== 0x02) throw new Error("bad DER int");
    const len = der[i++] ?? 0;
    let bytes = der.slice(i, i + len);
    i += len;
    while (bytes.length > 32 && bytes[0] === 0) bytes = bytes.slice(1);
    const out = new Uint8Array(32);
    out.set(bytes, 32 - bytes.length);
    return out;
  };
  const r = readInt();
  const s = readInt();
  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}

/**
 * Splits an SSV query string into the signed message and the signature/key_id.
 * Google signs every parameter that precedes "signature" (signature and key_id
 * are always last). Returns both the raw and the percent-decoded message:
 * Google's reference verifier signs the decoded form, which only differs from
 * the raw form when a value (e.g. reward_item or custom_data) needed encoding.
 */
export function splitSignedQuery(rawQuery: string): {
  messages: string[];
  signature: string | null;
  keyId: string | null;
} {
  const q = rawQuery.startsWith("?") ? rawQuery.slice(1) : rawQuery;
  const params = new URLSearchParams(q);
  const signature = params.get("signature");
  const keyId = params.get("key_id");
  const idx = q.indexOf("signature=");
  if (!signature || !keyId || idx <= 0) return { messages: [], signature, keyId };
  const raw = q.slice(0, idx - 1); // drop the "&" before signature=
  const messages = [raw];
  try {
    const decoded = decodeURIComponent(raw.replace(/\+/g, "%20"));
    if (decoded !== raw) messages.push(decoded);
  } catch {
    /* keep raw only */
  }
  return { messages, signature, keyId };
}

export type VerifyOutcome = "valid" | "invalid" | "unknown_key";

/** Verifies the callback signature against Google's published public keys. */
export async function verifySsvQuery(rawQuery: string, keys: VerifierKey[]): Promise<VerifyOutcome> {
  const { messages, signature, keyId } = splitSignedQuery(rawQuery);
  if (!signature || !keyId || messages.length === 0) return "invalid";
  const key = keys.find((k) => String(k.keyId) === keyId);
  if (!key) return "unknown_key";

  let raw: Uint8Array;
  let cryptoKey: CryptoKey;
  try {
    raw = derToRaw(b64ToBytes(signature));
    cryptoKey = await crypto.subtle.importKey(
      "spki",
      keyToSpki(key) as unknown as ArrayBuffer,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
  } catch {
    return "invalid";
  }
  for (const m of messages) {
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      cryptoKey,
      raw as unknown as ArrayBuffer,
      new TextEncoder().encode(m) as unknown as ArrayBuffer,
    );
    if (ok) return "valid";
  }
  return "invalid";
}

/**
 * Does the callback's ad_unit belong to the owner-configured rewarded unit?
 * AdMob sends only the numeric part after "/". No configured unit => accept.
 */
export function isExpectedAdUnit(adUnit: string | null | undefined, configured: string | null | undefined): boolean {
  if (!adUnit || !configured) return true;
  const expected = configured.split("/").pop();
  return adUnit === expected || adUnit === configured;
}
