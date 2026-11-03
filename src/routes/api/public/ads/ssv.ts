import { createFileRoute } from "@tanstack/react-router";
import { resolveSsvBinding } from "@/lib/ssv-binding";
import { isExpectedAdUnit, verifySsvQuery, type VerifierKey } from "@/lib/ssv-verify";

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

const VERIFIER_KEYS_URL = "https://www.gstatic.com/admob/reward/verifier-keys.json";

let keyCache: { at: number; keys: VerifierKey[] } | null = null;

async function getVerifierKeys(force = false): Promise<VerifierKey[]> {
  if (!force && keyCache && Date.now() - keyCache.at < 6 * 60 * 60 * 1000) return keyCache.keys;
  const res = await fetch(VERIFIER_KEYS_URL, { redirect: "follow" });
  if (!res.ok) throw new Error("verifier keys unavailable");
  const json = (await res.json()) as { keys: VerifierKey[] };
  keyCache = { at: Date.now(), keys: json.keys ?? [] };
  return keyCache.keys;
}

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rawQuery = url.search.startsWith("?") ? url.search.slice(1) : url.search;
  const params = url.searchParams;

  const transactionId = params.get("transaction_id");
  const customData = params.get("custom_data");
  const signature = params.get("signature");
  const keyId = params.get("key_id");
  const adNetwork = params.get("ad_network") ?? "admob";
  const adUnit = params.get("ad_unit");

  // Nothing to credit => this is a probe (AdMob's "Verify URL" check). Answer 200
  // so the console accepts the endpoint. No reward is granted on this path.
  const lookupId = transactionId ?? customData;
  if (!lookupId || !signature || !keyId) {
    return new Response("ok", { status: 200 });
  }

  // Verify Google's ECDSA signature. A key rotation => refetch keys once.
  let outcome: Awaited<ReturnType<typeof verifySsvQuery>>;
  try {
    outcome = await verifySsvQuery(rawQuery, await getVerifierKeys());
    if (outcome === "unknown_key") outcome = await verifySsvQuery(rawQuery, await getVerifierKeys(true));
  } catch {
    // Our side couldn't load Google's keys: ask AdMob to retry later.
    return new Response("verifier keys unavailable", { status: 503 });
  }
  // A real reward callback with a bad signature is rejected and never credited.
  if (outcome !== "valid") return new Response("unverified", { status: 401 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Only the ad unit configured by the app owner can credit rewards. AdMob's
  // "Verify URL" test is signed but uses a placeholder unit (1234567890) and no
  // custom_data: acknowledge it with 200 and credit nothing.
  const { data: settings } = await supabaseAdmin
    .from("ad_settings")
    .select("rewarded_ad_unit_id")
    .maybeSingle();
  if (!isExpectedAdUnit(adUnit, settings?.rewarded_ad_unit_id ?? null)) {
    return new Response("ok: verified, not credited (other ad unit)", { status: 200 });
  }



  // AdMob's own transaction_id is unique per real view: never credit it twice.
  if (transactionId) {
    const { data: seen } = await supabaseAdmin
      .from("ad_reward_transactions")
      .select("id")
      .eq("network_transaction_id", transactionId)
      .maybeSingle();
    if (seen) return new Response("duplicate", { status: 200 });
  }

  // Bind the callback to the user who started the view: custom_data is the
  // app's view-request id and user_id must be the owner of that request.
  const requestId = customData?.trim() || null;
  const { data: viewRequest } = requestId
    ? await supabaseAdmin.from("ad_view_requests").select("user_id").eq("transaction_id", requestId).maybeSingle()
    : { data: null };

  const binding = resolveSsvBinding({
    customData: requestId,
    claimedUserId: params.get("user_id"),
    requestOwnerId: viewRequest?.user_id ?? null,
  });

  if (!binding.ok) {
    if (binding.ownerId && requestId) {
      await supabaseAdmin.rpc("record_failed_ad_reward", {
        _user_id: binding.ownerId,
        _transaction_id: requestId,
        _ad_network: adNetwork,
      });
      await supabaseAdmin
        .from("ad_reward_transactions")
        .update({ failure_reason: binding.reason, network_transaction_id: transactionId })
        .eq("transaction_id", requestId)
        .neq("credit_status", "credited");
    }
    return new Response(binding.reason, { status: 200 });
  }

  // Gross value approved by the app's own earnings config — never the network payout
  // itself, and never exposed to the client. The user's share is 25% (in SQL).
  const grossValue = Number(process.env["AD_REWARD_GROSS_VALUE"] ?? "0.004");

  const { error } = await supabaseAdmin.rpc("credit_ad_reward", {
    _user_id: binding.userId,
    _transaction_id: binding.requestId,
    _gross_value: grossValue,
    _ad_network: adNetwork,
  });
  if (error) return new Response("error", { status: 500 });

  if (transactionId) {
    await supabaseAdmin
      .from("ad_reward_transactions")
      .update({ network_transaction_id: transactionId })
      .eq("transaction_id", binding.requestId)
      .is("network_transaction_id", null);
  }

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
