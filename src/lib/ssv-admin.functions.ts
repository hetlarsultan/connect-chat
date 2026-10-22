import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  transactionId: z.string().trim().min(1).max(200),
  note: z.string().trim().max(500).optional().default(""),
});

async function assertOwner(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  return Boolean(data);
}

/** Owner-only: approve a view whose automatic SSV check failed or never arrived, and credit the watcher. */
export const ownerApproveReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    if (!(await assertOwner(context))) return { ok: false as const, message: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const grossValue = Number(process.env["AD_REWARD_GROSS_VALUE"] ?? "0.004");
    const { data: res, error } = await supabaseAdmin.rpc("owner_manual_credit", {
      _owner_id: context.userId,
      _transaction_id: data.transactionId,
      _gross_value: grossValue,
      _note: data.note || undefined,
    });
    if (error) return { ok: false as const, message: "error" };
    const row = Array.isArray(res) ? res[0] : null;
    return {
      ok: Boolean(row?.credited),
      message: String(row?.message ?? "error"),
      reward: Number(row?.reward ?? 0),
    };
  });

/** Owner-only: reject a view (no reward). Never touches already-credited rewards. */
export const ownerRejectReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    if (!(await assertOwner(context))) return { ok: false as const, message: "forbidden" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin.rpc("owner_manual_reject", {
      _owner_id: context.userId,
      _transaction_id: data.transactionId,
      _note: data.note || undefined,
    });
    if (error) return { ok: false as const, message: "error" };
    return { ok: res === "ok", message: String(res ?? "error") };
  });
