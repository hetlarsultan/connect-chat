import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { diagnoseAdReward } from "@/lib/ad-diagnose.functions";

/** Owner-only AI diagnosis of reward verification failures. */
export function AdDiagnoseSection() {
  const diagnose = useServerFn(diagnoseAdReward);
  const [txId, setTxId] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await diagnose({ data: { transactionId: txId, details } });
      if (res.ok) setResult(res.text);
      else toast.error(res.error);
    } catch {
      toast.error("تعذّر إجراء التحليل الآن.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl bg-card border border-border p-4 space-y-3">
      <div>
        <h2 className="text-sm font-bold">تشخيص عمليات المكافأة بالذكاء الاصطناعي</h2>
        <p className="text-xs text-muted-foreground mt-1">
          أدخل رقم العملية (transaction_id) أو الصق رد AdMob، وسيحلّل Lovable AI سبب فشل التحقق ويقترح الخطوات التالية.
        </p>
      </div>
      <input
        value={txId}
        onChange={(e) => setTxId(e.target.value)}
        placeholder="transaction_id"
        dir="ltr"
        className="w-full rounded-2xl bg-background border border-border px-3 py-2 text-sm"
      />
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="تفاصيل إضافية: رمز الخطأ، رابط الاستدعاء، رسالة AdMob..."
        rows={4}
        maxLength={4000}
        className="w-full rounded-2xl bg-background border border-border px-3 py-2 text-sm"
      />
      <button
        onClick={() => void run()}
        disabled={busy || (!txId.trim() && !details.trim())}
        className="w-full py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
      >
        {busy ? "جارٍ التحليل..." : "حلّل العملية"}
      </button>
      {result && (
        <div className="rounded-2xl bg-muted p-3 text-sm whitespace-pre-wrap leading-relaxed">{result}</div>
      )}
    </section>
  );
}
