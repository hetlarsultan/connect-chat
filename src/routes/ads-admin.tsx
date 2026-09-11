import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  Banknote,
  Clock,
  Loader2,
  Lock,
  Percent,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/ads-admin")({
  head: () => ({
    meta: [
      { title: "لوحة الإعلانات - شات عالمي" },
      {
        name: "description",
        content: "لوحة مالك التطبيق لمتابعة عمليات الإعلانات المعلقة ونسبة التحقق والمكافآت المتراكمة وسحب الأرباح.",
      },
      { property: "og:title", content: "لوحة الإعلانات - شات عالمي" },
      {
        property: "og:description",
        content: "متابعة عمليات الإعلانات، نسبة نجاح التحقق، المكافآت المتراكمة، وسحب الأرباح بنسبة مئوية.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdsAdminPage,
});

type Stats = {
  total_count: number;
  pending_count: number;
  verified_count: number;
  failed_count: number;
  verification_rate: number;
  user_share_total: number;
  gross_total: number;
  transferred_total: number;
  available_total: number;
};

type Transfer = {
  id: string;
  amount: number;
  network_pct: number;
  network_amount: number;
  owner_amount: number;
  note: string | null;
  created_at: string;
};

function AdsAdminPage() {
  const { user, profile } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [amount, setAmount] = useState("");
  const [pct, setPct] = useState("30");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("owner_ads_stats");
    if (error) {
      setAllowed(false);
      setLoading(false);
      return;
    }
    setAllowed(true);
    const row = Array.isArray(data) ? data[0] : null;
    if (row) {
      setStats({
        total_count: Number(row.total_count ?? 0),
        pending_count: Number(row.pending_count ?? 0),
        verified_count: Number(row.verified_count ?? 0),
        failed_count: Number(row.failed_count ?? 0),
        verification_rate: Number(row.verification_rate ?? 0),
        user_share_total: Number(row.user_share_total ?? 0),
        gross_total: Number(row.gross_total ?? 0),
        transferred_total: Number(row.transferred_total ?? 0),
        available_total: Number(row.available_total ?? 0),
      });
    }
    const { data: t } = await supabase
      .from("revenue_transfers")
      .select("id,amount,network_pct,network_amount,owner_amount,note,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setTransfers((t ?? []) as Transfer[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const amt = Number(amount);
  const p = Number(pct);
  const validAmount = Number.isFinite(amt) && amt > 0 && (!stats || amt <= stats.available_total);
  const validPct = Number.isFinite(p) && p >= 0 && p <= 100;
  const split = useMemo(() => {
    if (!validAmount || !validPct) return { network: 0, owner: 0 };
    const network = (amt * p) / 100;
    return { network, owner: amt - network };
  }, [amt, p, validAmount, validPct]);

  const submit = async () => {
    if (!validAmount || !validPct || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("record_revenue_transfer", {
        _amount: amt,
        _network_pct: p,
        _note: note || undefined,
      });
      if (error) throw error;
      toast.success("تم تسجيل سحب الأرباح بنجاح.");
      setAmount("");
      setNote("");
      void load();
    } catch {
      toast.error("تعذّر تسجيل السحب، تحقق من المبلغ المتاح والنسبة.");
    } finally {
      setBusy(false);
    }
  };

  if (!profile) return null;

  if (allowed === false) {
    return (
      <AppShell>
        <PageHeader title="لوحة الإعلانات" />
        <div className="p-8 text-center space-y-3">
          <Lock className="size-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">هذه اللوحة متاحة لمالك التطبيق فقط.</p>
          <Link to="/earn" className="inline-block px-4 py-2 rounded-xl bg-primary/15 text-xs font-bold">
            العودة إلى شاهد واربح
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="لوحة الإعلانات" subtitle="متابعة العمليات ونسبة التحقق وسحب الأرباح" />

      <div className="p-4 space-y-4">
        {allowed === null && (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {allowed && stats && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <BarChart3 className="size-4 text-primary" /> ملخص العمليات
              </h2>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="p-2 rounded-xl bg-primary/15 disabled:opacity-50"
                aria-label="تحديث البيانات"
              >
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-2xl bg-surface border border-border">
                <Clock className="size-4 mx-auto text-amber-400" />
                <p className="text-lg font-bold tabular-nums mt-1">{stats.pending_count}</p>
                <p className="text-[10px] text-muted-foreground">عمليات معلقة</p>
              </div>
              <div className="p-3 rounded-2xl bg-surface border border-border">
                <ShieldCheck className="size-4 mx-auto text-emerald-400" />
                <p className="text-lg font-bold tabular-nums mt-1">{stats.verification_rate}%</p>
                <p className="text-[10px] text-muted-foreground">نسبة التحقق</p>
              </div>
              <div className="p-3 rounded-2xl bg-surface border border-border">
                <XCircle className="size-4 mx-auto text-red-400" />
                <p className="text-lg font-bold tabular-nums mt-1">{stats.failed_count}</p>
                <p className="text-[10px] text-muted-foreground">عمليات فاشلة</p>
              </div>
            </div>

            <div className="p-5 rounded-3xl gradient-brand glow-primary text-white">
              <div className="flex items-center gap-2 text-white/90 text-xs font-semibold">
                <Banknote className="size-4" /> قيمة المكافآت المتراكمة (حصة المستخدمين)
              </div>
              <p className="text-3xl font-bold mt-2 tabular-nums">{stats.user_share_total.toFixed(4)}</p>
              <p className="text-[11px] text-white/80 mt-2">
                المتاح للسحب الآن: <span className="font-bold tabular-nums">{stats.available_total.toFixed(4)}</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["إجمالي العمليات", String(stats.total_count)],
                ["عمليات متحقّقة", String(stats.verified_count)],
                ["إجمالي القيمة المعتمدة", stats.gross_total.toFixed(4)],
                ["إجمالي ما تم سحبه", stats.transferred_total.toFixed(4)],
              ].map(([label, value]) => (
                <div key={label} className="p-3 rounded-2xl bg-surface border border-border">
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <p className="font-bold tabular-nums mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {/* ---- سحب الأرباح حسب نسبة مئوية ---- */}
            <div className="p-4 rounded-2xl bg-surface border border-border space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Percent className="size-4 text-primary" /> سحب الأرباح
              </h3>
              <label className="block text-[11px] text-muted-foreground space-y-1">
                <span>المبلغ المسحوب</span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.0000"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm tabular-nums outline-none focus:border-primary"
                />
              </label>
              <label className="block text-[11px] text-muted-foreground space-y-1">
                <span>نسبة خدمة الإعلانات (%)</span>
                <input
                  value={pct}
                  onChange={(e) => setPct(e.target.value)}
                  inputMode="decimal"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm tabular-nums outline-none focus:border-primary"
                />
              </label>
              <div className="flex gap-1.5">
                {[10, 20, 30, 45].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setPct(String(v))}
                    className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold ${
                      Number(pct) === v ? "bg-primary text-white" : "bg-background border border-border"
                    }`}
                  >
                    {v}%
                  </button>
                ))}
              </div>
              <label className="block text-[11px] text-muted-foreground space-y-1">
                <span>ملاحظة (اختياري)</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="مثال: تسوية شهر سبتمبر"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm outline-none focus:border-primary"
                />
              </label>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-background border border-border">
                  <p className="text-muted-foreground text-[10px]">حصة خدمة الإعلانات</p>
                  <p className="font-bold tabular-nums">{split.network.toFixed(4)}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-background border border-border">
                  <p className="text-muted-foreground text-[10px]">حصتك كمالك</p>
                  <p className="font-bold tabular-nums">{split.owner.toFixed(4)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!validAmount || !validPct || busy}
                className="w-full py-3 rounded-2xl gradient-brand text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />}
                تسجيل السحب
              </button>
              {!validAmount && amount !== "" && (
                <p className="text-[10px] text-red-400">المبلغ غير صالح أو يتجاوز المتاح للسحب.</p>
              )}
            </div>

            {/* ---- سجل السحب ---- */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold">آخر عمليات السحب</h3>
              {transfers.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">لا توجد عمليات سحب مسجّلة بعد.</p>
              ) : (
                transfers.map((t) => (
                  <div key={t.id} className="p-3 rounded-2xl bg-surface border border-border text-[11px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold tabular-nums">{Number(t.amount).toFixed(4)}</span>
                      <span className="text-muted-foreground">
                        {new Date(t.created_at).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      خدمة الإعلانات {Number(t.network_pct)}% ({Number(t.network_amount).toFixed(4)}) — حصتك{" "}
                      {Number(t.owner_amount).toFixed(4)}
                    </p>
                    {t.note && <p className="text-muted-foreground/80">{t.note}</p>}
                  </div>
                ))
              )}
            </div>

            <Link
              to="/earn"
              className="block text-center py-2.5 rounded-2xl bg-primary/10 text-xs font-bold text-primary"
            >
              العودة إلى شاهد واربح
            </Link>
          </>
        )}
      </div>
    </AppShell>
  );
}
