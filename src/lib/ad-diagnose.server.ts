import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

/** Streams a diagnosis from Lovable AI and returns the final text. Server-only. */
export async function runAdDiagnosis(context: string): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("ai_not_configured");
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const result = streamText({
    model: provider.responses(MODEL),
    maxRetries: 0,
    system:
      "أنت خبير في AdMob Rewarded Ads والتحقق من جهة الخادم (SSV). حلّل بيانات العملية والسجلات المرفقة، " +
      "واشرح بالعربية وباختصار: 1) الحالة الحالية، 2) السبب المرجّح للفشل أو التعليق، 3) خطوات عملية مرقّمة للإصلاح. " +
      "قواعد النظام: المكافأة 25% من القيمة وتُضاف فقط بعد نجاح توقيع ECDSA من AdMob، ومرة واحدة لكل transaction_id، " +
      "ويجب أن يكون للعملية طلب مشاهدة مسجّل بنفس transaction_id (custom_data) ومن نفس المستخدم، ووحدة الإعلان مطابقة لإعدادات المالك. " +
      "لا تخترع بيانات غير موجودة. أقل من 250 كلمة.",
    messages: [{ role: "user", content: context }],
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  return await result.text;
}
