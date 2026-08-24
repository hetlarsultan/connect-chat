import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PlayCircle, Wallet, Loader2 } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { isRewardedAdAvailable, showRewardedAd } from "@/lib/rewarded-ad";

export const Route = createFileRoute("/earn")({
  head: () => ({
    meta: [
      { title: "شاهد واربح - شات عالمي" },
      { name: "description", content: "شاهد إعلاناً مكافأة واحصل على نسبتك في محفظتك داخل التطبيق." },
      { property: "og:title", content: "شاهد واربح - شات عالمي" },
      { property: "og:description", content: "شاهد إعلاناً مكافأة واحصل على نسبتك في محفظتك داخل التطبيق." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EarnPage,
});

type Txn = {
  id: string;
  transaction_id: string;
  reward_amount: number;
  verification_status: string;
  credit_status: string;
  occurred_at: string;
  notified_at: string | null;
};

function EarnPage() {
  const { user, profile } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [w, t] = await Promise.all([
      supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("ad_reward_transactions")
        .select("id,transaction_id,reward_amount,verification_status,credit_status,occurred_at,notified_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setBalance(Number(w.data?.balance ?? 0));
    const rows = (t.data ?? []) as Txn[];
    setTxns(rows);

    // Notify only after the reward is actually credited to the wallet.
    const fresh = rows.filter((r) => r.credit_status === "credited" && !r.notified_at);
    if (fresh.length) {
      toast.success("تمت إضافة مكافأتك إلى محفظتك بنجاح.");
      setWaiting(false);
      await supabase
        .from("ad_reward_transactions")
        .update({ notified_at: new Date().toISOString() })
        .in("id", fresh.map((f) => f.id));
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!waiting || !user) return;
    let ticks = 0;
    pollRef.current = setInterval(() => {
      ticks += 1;
      void load();
      if (ticks > 20) {
        setWaiting(false);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [waiting, user, load]);

  const watch = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const transactionId = crypto.randomUUID();
      const { error } = await supabase.from("ad_view_requests").insert({
        transaction_id: transactionId,
        user_id: user.id,
      });
      if (error) throw error;

      const res = await showRewardedAd(user.id, transactionId);
      if (!res.shown) {
        toast.error(
          res.reason === "unavailable"
            ? "الإعلانات غير متاحة على هذا الجهاز حالياً."
            : "تعذّر تشغيل الإعلان، حاول لاحقاً.",
        );
        return;
      }
      setWaiting(true);
      toast.info("جاري التحقق من المشاهدة...");
      void load();
    } catch {
      toast.error("تعذّر بدء العملية، حاول لاحقاً.");
    } finally {
      setBusy(false);
    }
  };

  if (!profile) return null;

  return (
    <AppShell>
      <PageHeader title="شاهد واربح" subtitle="مكافأتك تُضاف بعد التحقق من المشاهدة" />

      <div className="p-4 space-y-4">
        <div className="p-5 rounded-3xl gradient-brand glow-primary text-white">
          <div className="flex items-center gap-2 text-white/90 text-xs font-semibold">
            <Wallet className="size-4" /> محفظتي داخل التطبيق
          </div>
          <p className="text-3xl font-bold mt-2 tabular-nums">
            {balance === null ? "—" : balance.toFixed(4)}
          </p>
          <p className="text-[11px] text-white/80 mt-2 leading-relaxed">
            الأرصدة تقديرية وقابلة للتعديل بعد التسويات والتحقق من صحة النشاط، وليست مبلغاً نهائياً قابلاً للسحب.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void watch()}
          disabled={busy || waiting}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-primary-foreground font-bold disabled:opacity-60"
        >
          {busy || waiting ? <Loader2 className="size-5 animate-spin" /> : <PlayCircle className="size-5" />}
          {waiting ? "جاري التحقق من المشاهدة..." : "شاهد واربح"}
        </button>

        {!isRewardedAdAvailable() && (
          <p className="text-[11px] text-muted-foreground text-center">
            مشاهدة الإعلان اختيارية بالكامل، وتتوفر عند تشغيل التطبيق على جهاز يدعم إعلانات المكافأة.
          </p>
        )}

        <div>
          <h3 className="text-sm font-bold text-muted-foreground mb-2 px-1">سجل المكافآت</h3>
          <div className="space-y-2">
            {txns.length === 0 && (
              <p className="text-xs text-muted-foreground px-1">لا توجد عمليات بعد.</p>
            )}
            {txns.map((t) => (
              <div key={t.id} className="p-3 rounded-2xl bg-surface border border-border text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold tabular-nums">+{Number(t.reward_amount).toFixed(4)}</span>
                  <span
                    className={
                      t.credit_status === "credited"
                        ? "text-green-400 font-semibold"
                        : t.verification_status === "failed"
                          ? "text-red-400 font-semibold"
                          : "text-muted-foreground"
                    }
                  >
                    {t.credit_status === "credited"
                      ? "تمت الإضافة"
                      : t.verification_status === "failed"
                        ? "لم يتم التحقق"
                        : "قيد التحقق"}
                  </span>
                </div>
                <div className="mt-1 text-muted-foreground">
                  {new Date(t.occurred_at).toLocaleString("ar")}
                </div>
                <div className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">
                  رقم العملية: {t.transaction_id}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
