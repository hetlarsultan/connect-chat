import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  transactionId: z.string().trim().max(200).optional().default(""),
  details: z.string().trim().max(4000).optional().default(""),
});

/** Owner-only: AI diagnosis of an AdMob reward transaction. */
export const diagnoseAdReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return { ok: false as const, error: "هذه الأداة متاحة للمالك فقط." };
    if (!data.transactionId && !data.details) {
      return { ok: false as const, error: "أدخل رقم العملية أو تفاصيلها." };
    }

    let record: unknown = null;
    let viewRequest: unknown = null;
    let settings: unknown = null;
    if (data.transactionId) {
      const [{ data: tx }, { data: vr }] = await Promise.all([
        context.supabase
          .from("ad_reward_transactions")
          .select("transaction_id,user_id,ad_network,reward_amount,verification_status,credit_status,occurred_at,updated_at")
          .eq("transaction_id", data.transactionId)
          .maybeSingle(),
        context.supabase
          .from("ad_view_requests")
          .select("user_id,created_at")
          .eq("transaction_id", data.transactionId)
          .maybeSingle(),
      ]);
      record = tx;
      viewRequest = vr;
    }
    const { data: s } = await context.supabase
      .from("ad_settings")
      .select("rewarded_ad_unit_id,ads_enabled,rewarded_enabled")
      .maybeSingle();
    settings = s;
    const { data: errs } = await context.supabase
      .from("ad_error_logs")
      .select("stage,message,ad_unit_id,created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    const ctx = [
      `transaction_id: ${data.transactionId || "غير مذكور"}`,
      `سجل العملية في قاعدة البيانات: ${JSON.stringify(record) ?? "غير موجود"}`,
      `طلب المشاهدة المسجّل: ${JSON.stringify(viewRequest) ?? "غير موجود"}`,
      `إعدادات الإعلانات: ${JSON.stringify(settings)}`,
      `آخر أخطاء التحميل: ${JSON.stringify(errs ?? [])}`,
      `تفاصيل من المالك (رد AdMob/سجلات): ${data.details || "لا يوجد"}`,
    ].join("\n");

    try {
      const { runAdDiagnosis } = await import("./ad-diagnose.server");
      const text = await runAdDiagnosis(ctx);
      if (!text.trim()) return { ok: false as const, error: "لم يُرجع التحليل أي نتيجة." };
      return { ok: true as const, text, found: Boolean(record) };
    } catch (e) {
      const status = (e as { statusCode?: number })?.statusCode;
      const msg =
        status === 402
          ? "نفد رصيد الذكاء الاصطناعي. أضف رصيدًا من إعدادات مساحة العمل."
          : status === 429
            ? "طلبات كثيرة، حاول بعد دقيقة."
            : "تعذّر إجراء التحليل الآن.";
      console.error("diagnose failed", e);
      return { ok: false as const, error: msg };
    }
  });
