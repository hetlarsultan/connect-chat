/**
 * Decides which user (if any) a signed AdMob SSV callback may credit.
 *
 * The app passes two values to AdMob when the user starts a view:
 *   - user_id      = the signed-in user who chose to watch
 *   - custom_data  = the app's own view-request id (row in ad_view_requests)
 * A reward is granted only when BOTH come back and the user_id equals the
 * owner of that recorded view request — so a callback can never credit a
 * different user than the one who watched the ad.
 */

export type SsvBindingInput = {
  customData: string | null | undefined;
  claimedUserId: string | null | undefined;
  /** Owner of the ad_view_requests row whose id equals custom_data (null if none). */
  requestOwnerId: string | null | undefined;
};

export type SsvBindingResult =
  | { ok: true; userId: string; requestId: string }
  | {
      ok: false;
      reason: "missing_custom_data" | "unknown_request" | "missing_user_id" | "user_mismatch";
      /** Owner to record the failure against (only when the request is known). */
      ownerId: string | null;
    };

export function resolveSsvBinding(input: SsvBindingInput): SsvBindingResult {
  const requestId = input.customData?.trim() || "";
  if (!requestId) return { ok: false, reason: "missing_custom_data", ownerId: null };

  const owner = input.requestOwnerId?.trim() || "";
  if (!owner) return { ok: false, reason: "unknown_request", ownerId: null };

  const claimed = input.claimedUserId?.trim() || "";
  if (!claimed) return { ok: false, reason: "missing_user_id", ownerId: owner };
  if (claimed !== owner) return { ok: false, reason: "user_mismatch", ownerId: owner };

  return { ok: true, userId: owner, requestId };
}

/** Arabic labels for failure reasons shown to the owner. */
export const FAILURE_REASON_LABELS: Record<string, string> = {
  missing_custom_data: "لم يصل custom_data من AdMob",
  unknown_request: "لا يوجد طلب مشاهدة مطابق",
  missing_user_id: "لم يصل user_id من AdMob",
  user_mismatch: "user_id لا يطابق صاحب طلب المشاهدة",
  manual_reject: "رُفضت يدويًا من المالك",
};
