import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Banknote, Loader2, Lock, ArrowLeft, Percent, ListOrdered } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/payouts")({
  head: () => ({
    meta: [
      { title: "سحب الأرباح - شات عالمي" },
      { name: "description", content: "واجهة مالك التطبيق لسحب الأرباح وتقسيمها مع خدمة الإعلانات وسجل التحويلات." },
      { property: "og:title", content: "سحب الأرباح - شات عالمي" },
      { property: "og:description", content: "سحب الأرباح وتقسيمها بنسبة مئوية مع خدمة الإعلانات وسجل تحويلات كامل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PayoutsPage,
});

type Overview = {
  credited_count: number;
  users_count: number;
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
  status: string;
  created_at: string;
};

function PayoutsPage() {
  const { user, profile } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [ov, setOv] = useState<Overview | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [amount, setAmount] = useState("");
  const [pct, setPct] = useState("30");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc("owner_reward_overview");
    if (error) {
      setAllowed(false);
      return;
    }
    setAllowed(true);
    const row = Array.isArray(data) ? data[0] : null;
    if (row) {
      setOv({
        credited_count: Number(row.credited_count ?? 0),
        users_count: Number(row.users_count ?? 0),
        user_share_total: Number(row.user_share_total ?? 0),
        gross_total: Number(row.gross_total ?? 0),
        transferred_total: Number(row.transferred_total ?? 0),
        available_total: Number(row.available_total ?? 0),
      });
    }
    const { data: t } = await supabase
      .from("revenue_transfers")
      .select("id,amount,network_pct,network_amount,owner_amount,note,status,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setTransfers((t ?? []) as Transfer[]);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const amt = Number(amount);
  const p = Number(pct);
  const validAmount = Number.isFinite(amt) && amt > 0 && (!ov || amt <= ov.available_total);
  const validPct = Number.isFinite(p) && p >= 0 && p <= 100;
  const networkAmount = validAmount && validPct ? (amt * p) / 100 : 0;
  const ownerAmount = validAmount && validPct ? amt - networkAmount : 0;

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
      toast.success("تم تسجيل تحويل الأرباح بنجاح.");
      setAmount("");
      setNote("");
      void load();
    } catch {
      toast.error("تعذّر تسجيل التحويل، تحقق من المبلغ المتاح والنسبة.");
    } finally {
      setBusy(false);
    }
  };

  if (!profile) return null;

  if (allowed === false) {
    return (
      <AppShell>
        <PageHeader title="سحب الأرباح" />
        <div className="p-8 text-center space-y-3">
          <Lock className="size-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">هذه الصفحة متاحة لمالك التطبيق فقط.</p>
          <Link to="/earn" className="inline-block px-4 py-2 rounded-xl bg-primary/15 text-xs font-bold">
            العودة إلى شاهد واربح
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="سحب الأرباح" subtitle="تقسيم القيمة مع خدمة الإعلانات وسجل التحويلات" />

      <div className="p-4 space-y-4">
        {allowed === null && (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {allowed && ov && (
          <>
            <div className="p-5 rounded-3xl gradient-brand glow-primary text-white">
              <div className="flex items-center gap-2 text-white/90 text-xs font-semibold">
                <Banknote className="size-4" /> المتاح للسحب
              </div>
              <p className="text-3xl font-bold mt-2 tabular-nums">{ov.available_total.toFixed(4)}</p>
              <p className="text-[11px] text-white/80 mt-2">
                محسوب من سجل العمليات المتحقّق منها بعد خصم حصة المستخدمين (25%) والتحويلات السابقة.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["إجمالي القيمة المعتمدة", ov.gross_total.toFixed(4)],
                ["حصة المستخدمين (25%)", ov.user_share_total.toFixed(4)],
                ["إجمالي ما تم تحويله", ov.transferred_total.toFixed(4)],
                ["عمليات متحقّقة", String(ov.credited_count)],
                ["مستخدمون مستفيدون", String(ov.users_count)],
              ].map(([label, value]) => (
                <div key={label} className="p-3 rounded-2xl bg-surface border border-border">
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <p className="font-bold tabular-nums mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-border space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Percent className="size-4 text-primary" /> تسجيل سحب جديد
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
                  <p className="text-muted-foreground">حصة خدمة الإعلانات</p>
                  <p className="font-bold tabular-nums">{networkAmount.toFixed(4)}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-background border border-border">
                  <p className="text-muted-foreground">حصة المالك</p>
                  <p className="font-bold tabular-nums">{ownerAmount.toFixed(4)}</p>
                </div>
              </div>
              {amount && !validAmount && (
                <p className="text-[11px] text-red-400">المبلغ غير صالح أو أكبر من المتاح للسحب.</p>
              )}
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!validAmount || !validPct || busy}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />}
                تسجيل التحويل
              </button>
            </div>

            <div>
              <h3 className="text-sm font-bold text-muted-foreground flex items-center gap-2 px-1 mb-2">
                <ListOrdered className="size-4" /> سجل تحويلات الأرباح
              </h3>
              <div className="space-y-2">
                {transfers.length === 0 && (
                  <p className="text-xs text-muted-foreground px-1">لا توجد تحويلات مسجّلة بعد.</p>
                )}
                {transfers.map((t) => (
                  <div key={t.id} className="p-3 rounded-2xl bg-surface border border-border text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold tabular-nums">{Number(t.amount).toFixed(4)}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(t.created_at).toLocaleString("ar")}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      خدمة الإعلانات {Number(t.network_pct)}% ({Number(t.network_amount).toFixed(4)}) · المالك{" "}
                      {Number(t.owner_amount).toFixed(4)}
                    </div>
                    {t.note && <p className="text-[10px] text-muted-foreground/80 mt-1">{t.note}</p>}
                  </div>
                ))}
              </div>
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
