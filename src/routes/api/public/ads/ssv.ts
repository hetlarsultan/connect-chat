import { createFileRoute } from "@tanstack/react-router";

/**
 * Rewarded-ad Server-Side Verification (SSV) callback.
 *
 * The ad network calls this endpoint directly after a completed rewarded view.
 * The reward is credited ONLY here — never from the client. The signature is
 * verified against the network's published public keys before anything is
 * written to the wallet.
 *
 * AdMob SSV callback shape:
 *   ...?ad_network=..&ad_unit=..&reward_amount=..&timestamp=..
 *      &transaction_id=..&user_id=..&signature=..&key_id=..
 * The signed message is the raw query string up to (but excluding) "&signature=".
 */

const VERIFIER_KEYS_URL = "https://gstatic.com/admob/reward/verifier-keys.json";

type VerifierKey = { keyId: number; pem: string; base64: string };

let keyCache: { at: number; keys: VerifierKey[] } | null = null;

async function getVerifierKeys(): Promise<VerifierKey[]> {
  if (keyCache && Date.now() - keyCache.at < 6 * 60 * 60 * 1000) return keyCache.keys;
  const res = await fetch(VERIFIER_KEYS_URL);
  if (!res.ok) throw new Error("verifier keys unavailable");
  const json = (await res.json()) as { keys: VerifierKey[] };
  keyCache = { at: Date.now(), keys: json.keys ?? [] };
  return keyCache.keys;
}

function b64ToBytes(b64: string): Uint8Array {
  const norm = b64.replace(/-/g, "+").replace(/_/g, "/");
  const padded = norm + "=".repeat((4 - (norm.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function pemToSpki(pem: string): Uint8Array {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return b64ToBytes(body);
}

/** DER ECDSA signature -> raw r||s (P-256, 32 bytes each) as WebCrypto expects. */
function derToRaw(der: Uint8Array): Uint8Array {
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

async function verifySignature(message: string, signatureB64: string, keyId: string): Promise<boolean> {
  const keys = await getVerifierKeys();
  const key = keys.find((k) => String(k.keyId) === keyId);
  if (!key) return false;
  const spki = key.pem ? pemToSpki(key.pem) : b64ToBytes(key.base64);
  const cryptoKey = await crypto.subtle.importKey(
    "spki",
    spki as unknown as ArrayBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const raw = derToRaw(b64ToBytes(signatureB64));
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    raw as unknown as ArrayBuffer,
    new TextEncoder().encode(message) as unknown as ArrayBuffer,
  );
}

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rawQuery = url.search.startsWith("?") ? url.search.slice(1) : url.search;
  const params = url.searchParams;

  const transactionId = params.get("transaction_id");
  const userId = params.get("user_id");
  const signature = params.get("signature");
  const keyId = params.get("key_id");
  const adNetwork = params.get("ad_network") ?? "admob";

  if (!transactionId || !userId) return new Response("missing params", { status: 400 });

  const sigIndex = rawQuery.indexOf("&signature=");
  const message = sigIndex >= 0 ? rawQuery.slice(0, sigIndex) : "";

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // The view must have been started by this signed-in user (own choice to watch).
  const { data: viewRequest } = await supabaseAdmin
    .from("ad_view_requests")
    .select("user_id")
    .eq("transaction_id", transactionId)
    .maybeSingle();

  let ok = false;
  if (signature && keyId && message) {
    try {
      ok = await verifySignature(message, signature, keyId);
    } catch {
      ok = false;
    }
  }

  if (!ok || !viewRequest || viewRequest.user_id !== userId) {
    if (viewRequest) {
      await supabaseAdmin.rpc("record_failed_ad_reward", {
        _user_id: viewRequest.user_id,
        _transaction_id: transactionId,
        _ad_network: adNetwork,
      });
    }
    return new Response("unverified", { status: 401 });
  }

  // Gross value approved by the app's own earnings config — never the network payout
  // itself, and never exposed to the client. The user's share is 25% (in SQL).
  const grossValue = Number(process.env["AD_REWARD_GROSS_VALUE"] ?? "0.004");

  const { error } = await supabaseAdmin.rpc("credit_ad_reward", {
    _user_id: userId,
    _transaction_id: transactionId,
    _gross_value: grossValue,
    _ad_network: adNetwork,
  });
  if (error) return new Response("error", { status: 500 });

  return new Response("ok");
}

export const Route = createFileRoute("/api/public/ads/ssv")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
