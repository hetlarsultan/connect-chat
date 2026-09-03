import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Coins, ShieldCheck, ShieldAlert, Clock, Wallet, ArrowLeft, Loader2 } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/rewards")({
  head: () => ({
    meta: [
      { title: "مكافآتي المتراكمة - شات عالمي" },
      { name: "description", content: "مجموع مكافآتك المتراكمة من مشاهدة الإعلانات وحالة كل عملية تحقق." },
      { property: "og:title", content: "مكافآتي المتراكمة - شات عالمي" },
      { property: "og:description", content: "مجموع مكافآتك المتراكمة من مشاهدة الإعلانات وحالة كل عملية تحقق." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RewardsPage,
});

type Totals = {
  credited_count: number;
  pending_count: number;
  failed_count: number;
  total_earned: number;
  wallet_balance: number;
  first_at: string | null;
  last_at: string | null;
};

function RewardsPage() {
  const { user, profile } = useAuth();
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.rpc("my_reward_totals");
    const row = Array.isArray(data) ? data[0] : null;
    if (row) {
      setTotals({
        credited_count: Number(row.credited_count ?? 0),
        pending_count: Number(row.pending_count ?? 0),
        failed_count: Number(row.failed_count ?? 0),
        total_earned: Number(row.total_earned ?? 0),
        wallet_balance: Number(row.wallet_balance ?? 0),
        first_at: row.first_at ?? null,
        last_at: row.last_at ?? null,
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  /* تحديث الملخّص عند وجود عمليات قيد المراجعة (الإشعار بتغيّر الحالة يعمل في كل الصفحات). */
  useEffect(() => {
    if (!totals || totals.pending_count === 0) return;
    const t = setInterval(() => {
      if (!document.hidden) void load();
    }, 15_000);
    return () => clearInterval(t);
  }, [totals, load]);

  if (!profile) return null;

  return (
    <AppShell>
      <PageHeader title="مكافآتي المتراكمة" subtitle="ملخّص كل مكافآتك منذ أول مشاهدة" />

      <div className="p-4 space-y-4">
        <div className="p-5 rounded-3xl gradient-brand glow-primary text-white">
          <div className="flex items-center gap-2 text-white/90 text-xs font-semibold">
            <Coins className="size-4" /> مجموع المكافآت المتراكمة
          </div>
          <p className="text-3xl font-bold mt-2 tabular-nums">
            {loading || !totals ? "—" : totals.total_earned.toFixed(4)}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-white/85 mt-2">
            <Wallet className="size-3.5" /> رصيد المحفظة الحالي:{" "}
            <span className="tabular-nums font-bold">{totals ? totals.wallet_balance.toFixed(4) : "—"}</span>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && totals && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 rounded-2xl bg-surface border border-border text-center">
                <ShieldCheck className="size-4 mx-auto text-green-400" />
                <p className="text-lg font-bold tabular-nums mt-1">{totals.credited_count}</p>
                <p className="text-[10px] text-muted-foreground">مضافة</p>
              </div>
              <div className="p-3 rounded-2xl bg-surface border border-border text-center">
                <Clock className="size-4 mx-auto text-muted-foreground" />
                <p className="text-lg font-bold tabular-nums mt-1">{totals.pending_count}</p>
                <p className="text-[10px] text-muted-foreground">قيد المراجعة</p>
              </div>
              <div className="p-3 rounded-2xl bg-surface border border-border text-center">
                <ShieldAlert className="size-4 mx-auto text-red-400" />
                <p className="text-lg font-bold tabular-nums mt-1">{totals.failed_count}</p>
                <p className="text-[10px] text-muted-foreground">فاشلة</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-border text-xs space-y-1.5 text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>أول مشاهدة</span>
                <span>{totals.first_at ? new Date(totals.first_at).toLocaleString("ar") : "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>آخر مشاهدة</span>
                <span>{totals.last_at ? new Date(totals.last_at).toLocaleString("ar") : "—"}</span>
              </div>
              <p className="text-[10px] leading-relaxed pt-1">
                يُحسب المجموع من العمليات التي تم التحقق منها عبر SSV فقط، وتصلك رسالة داخل التطبيق فور تغيّر حالة أي
                عملية من «قيد المراجعة» إلى ناجح أو فشل.
              </p>
            </div>
          </>
        )}

        <Link
          to="/earn"
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary/15 text-xs font-bold"
        >
          <ArrowLeft className="size-4" /> العودة إلى شاهد واربح
        </Link>
      </div>
    </AppShell>
  );
}
