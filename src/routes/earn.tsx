import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  PlayCircle,
  Wallet,
  Loader2,
  FlaskConical,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Search,
  Download,
  RefreshCw,
} from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import {
  isRewardedAdAvailable,
  showRewardedAd,
  isMockMode,
  setMockMode,
  runMockFlow,
  type MockOutcome,
} from "@/lib/rewarded-ad";


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

type MockTxn = {
  id: string;
  transaction_id: string;
  verification_status: "pending" | "verified" | "failed" | "cancelled";
  occurred_at: string;
};

function StatusPill({ verification, credit }: { verification: string; credit: string }) {
  const credited = credit === "credited";
  const failed = verification === "failed" || verification === "cancelled";
  const Icon = credited ? ShieldCheck : failed ? ShieldAlert : Clock;
  const cls = credited
    ? "text-green-400"
    : failed
      ? "text-red-400"
      : "text-muted-foreground";
  const label = credited
    ? "تم التحقق وأُضيفت المكافأة"
    : verification === "cancelled"
      ? "أُلغي الإعلان — بدون رصيد"
      : verification === "failed"
        ? "فشل التحقق — بدون رصيد"
        : "قيد التحقق (SSV)";
  return (
    <span className={`flex items-center gap-1 font-semibold ${cls}`}>
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}

type StatusKey = "credited" | "pending" | "failed";

function statusKey(t: { verification_status: string; credit_status: string }): StatusKey {
  if (t.credit_status === "credited") return "credited";
  if (t.verification_status === "failed" || t.verification_status === "cancelled") return "failed";
  return "pending";
}

function statusLabel(t: { verification_status: string; credit_status: string }): string {
  const k = statusKey(t);
  return k === "credited" ? "ناجح" : k === "failed" ? "فشل" : "قيد المراجعة";
}

/** توضيح سبب الحالة قدر ما تسمح به بيانات الاستجابة المخزّنة. */
function statusDetail(t: { verification_status: string; credit_status: string }): string {
  if (t.credit_status === "credited") return "تم التحقق من المشاهدة عبر SSV وأُضيفت النسبة إلى محفظتك.";
  if (t.verification_status === "cancelled")
    return "السبب: أُلغي الإعلان أو أُغلق قبل إكمال المشاهدة، لذلك لم تصل استجابة تحقق صالحة ولم يُضف أي رصيد.";
  if (t.verification_status === "failed")
    return "السبب: لم يُقبل توقيع التحقق (SSV) من شبكة الإعلانات أو لم تتطابق بيانات العملية، لذلك لم يُضف أي رصيد.";
  if (t.verification_status === "verified" && t.credit_status !== "credited")
    return "تم التحقق من المشاهدة، وإضافة الرصيد قيد المعالجة.";
  return "لم تصل استجابة التحقق (SSV) من شبكة الإعلانات بعد. يمكنك إعادة محاولة جلب الحالة دون إعادة تشغيل الإعلان.";
}

function toCsv(rows: Txn[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const head = ["transaction_id", "occurred_at", "status", "reason"].map(esc).join(",");
  const body = rows.map((t) =>
    [
      esc(t.transaction_id),
      esc(new Date(t.occurred_at).toISOString()),
      esc(statusLabel(t)),
      esc(statusDetail(t)),
    ].join(","),
  );
  return [head, ...body].join("\r\n");
}

const REFRESH_KEY = "earn_auto_refresh_secs_v1";
const REFRESH_OPTIONS = [10, 20, 30] as const;

function loadRefreshSecs(): number {
  if (typeof window === "undefined") return 10;
  try {
    const v = Number(localStorage.getItem(REFRESH_KEY));
    return REFRESH_OPTIONS.includes(v as 10 | 20 | 30) ? v : 10;
  } catch {
    return 10;
  }
}

function EarnPage() {
  const { user, profile } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [mock, setMock] = useState(false);
  const [mockTxns, setMockTxns] = useState<MockTxn[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StatusKey>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [recheckId, setRecheckId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshSecs, setRefreshSecs] = useState(10);
  const [isOwner, setIsOwner] = useState(false);
  const [ssvUrl, setSsvUrl] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockRef = useRef(false);

  useEffect(() => {
    setMock(isMockMode());
    setRefreshSecs(loadRefreshSecs());
    setSsvUrl(`${window.location.origin}/api/public/ads/ssv`);
  }, []);

  /* هل هذا الحساب مالك التطبيق؟ (لعرض واجهة سحب الأرباح) */
  useEffect(() => {
    if (!user) return;
    let alive = true;
    void supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setIsOwner(Boolean(data));
      });
    return () => {
      alive = false;
    };
  }, [user]);


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

    // Clear, explicit in-app message when SSV verification failed (no credit).
    const failed = rows.filter((r) => r.verification_status === "failed" && !r.notified_at);
    if (failed.length) {
      toast.error("لم يتم التحقق من المشاهدة، لذلك لم يُضف أي رصيد.");
      setWaiting(false);
      await supabase
        .from("ad_reward_transactions")
        .update({ notified_at: new Date().toISOString() })
        .in("id", failed.map((f) => f.id));
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
        toast.error("انتهت مدة انتظار التحقق من المشاهدة، لم يُضف أي رصيد حتى الآن.");
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [waiting, user, load]);

  const hasPending = useMemo(
    () => txns.some((t) => t.verification_status === "pending" && t.credit_status !== "credited"),
    [txns],
  );

  /* تحديث تلقائي لحالة SSV بالتردد المختار ما دامت هناك عمليات قيد المراجعة. */
  useEffect(() => {
    if (!user || !hasPending || !autoRefresh) return;
    const t = setInterval(() => {
      if (document.hidden) return;
      void load();
    }, refreshSecs * 1000);
    return () => clearInterval(t);
  }, [user, hasPending, autoRefresh, refreshSecs, load]);

  const locked = busy || waiting;

  const watch = async () => {
    if (!user || lockRef.current || locked) return;
    lockRef.current = true;
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
            : res.reason === "cancelled"
              ? "تم إلغاء الإعلان قبل إكماله، لذلك لم يُضف أي رصيد."
              : "تعذّر تشغيل الإعلان، ولم يُضف أي رصيد.",
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
      lockRef.current = false;
    }
  };

  /* Mock flow: simulated only — no wallet, no database, no user data changes. */
  const runMock = async (outcome: MockOutcome) => {
    if (lockRef.current || locked) return;
    lockRef.current = true;
    setBusy(true);
    const transactionId = `mock-${crypto.randomUUID()}`;
    setMockTxns((prev) =>
      [{ id: transactionId, transaction_id: transactionId, verification_status: "pending", occurred_at: new Date().toISOString() } as MockTxn, ...prev].slice(0, 10),
    );
    try {
      const { result } = await runMockFlow(outcome);
      if (!result.shown) {
        setMockTxns((p) => p.map((m) => (m.id === transactionId ? { ...m, verification_status: "cancelled" } : m)));
        toast.error("(تجريبي) تم إلغاء الإعلان، لذلك لم يُضف أي رصيد.");
        return;
      }
      toast.info("(تجريبي) جاري التحقق من المشاهدة...");
      await new Promise((r) => setTimeout(r, 1500));
      if (outcome === "verified") {
        setMockTxns((p) => p.map((m) => (m.id === transactionId ? { ...m, verification_status: "verified" } : m)));
        toast.success("(تجريبي) نجح التحقق — لم يُضف رصيد فعلي في وضع الاختبار.");
      } else {
        setMockTxns((p) => p.map((m) => (m.id === transactionId ? { ...m, verification_status: "failed" } : m)));
        toast.error("(تجريبي) فشل التحقق من المشاهدة، بدون منح أي رصيد.");
      }
    } finally {
      setBusy(false);
      lockRef.current = false;
    }
  };

  const stats = useMemo(() => {
    const credited = txns.filter((t) => t.credit_status === "credited").length;
    const pending = txns.filter((t) => t.credit_status !== "credited" && t.verification_status === "pending").length;
    const failed = txns.filter((t) => t.verification_status === "failed").length;
    return { credited, pending, failed };
  }, [txns]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
    return txns.filter((t) => {
      if (q && !t.transaction_id.toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && statusKey(t) !== statusFilter) return false;
      const ts = new Date(t.occurred_at).getTime();
      if (from !== null && ts < from) return false;
      if (to !== null && ts > to) return false;
      return true;
    });
  }, [txns, query, statusFilter, dateFrom, dateTo]);

  /** إعادة جلب حالة التحقق (SSV) للعملية من قاعدة البيانات دون إعادة تشغيل الإعلان. */
  const recheck = async (row: Txn) => {
    if (!user) return;
    setRecheckId(row.id);
    try {
      const { data } = await supabase
        .from("ad_reward_transactions")
        .select("id,transaction_id,reward_amount,verification_status,credit_status,occurred_at,notified_at")
        .eq("user_id", user.id)
        .eq("transaction_id", row.transaction_id)
        .maybeSingle();
      if (data) {
        const fresh = data as Txn;
        setTxns((prev) => prev.map((t) => (t.id === fresh.id ? fresh : t)));
        if (fresh.credit_status === "credited") toast.success("تمت إضافة مكافأتك إلى محفظتك بنجاح.");
        else if (fresh.verification_status === "failed") toast.error("فشل التحقق من المشاهدة، لذلك لم يُضف أي رصيد.");
        else toast.info("لا تزال العملية قيد التحقق (SSV).");
      } else {
        toast.info("لا تزال العملية قيد التحقق (SSV).");
      }
      void load();
    } catch {
      toast.error("تعذّر جلب حالة التحقق، حاول لاحقاً.");
    } finally {
      setRecheckId(null);
    }
  };

  const downloadCsv = () => {
    if (!filtered.length) {
      toast.info("لا توجد عمليات لتنزيلها.");
      return;
    }
    const blob = new Blob(["\ufeff" + toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rewards-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
          onClick={() => void (mock ? runMock("verified") : watch())}
          disabled={locked}
          aria-busy={locked}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-primary-foreground font-bold disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {locked ? <Loader2 className="size-5 animate-spin" /> : <PlayCircle className="size-5" />}
          {waiting ? "جاري التحقق من المشاهدة..." : busy ? "جاري تحميل الإعلان..." : "شاهد واربح"}
        </button>

        {locked && (
          <p className="text-[11px] text-muted-foreground text-center">
            الزر مقفل مؤقتاً لمنع تكرار العملية حتى انتهاء التحقق.
          </p>
        )}

        {!isRewardedAdAvailable() && !mock && (
          <p className="text-[11px] text-muted-foreground text-center">
            مشاهدة الإعلان اختيارية بالكامل، وتتوفر عند تشغيل التطبيق على جهاز يدعم إعلانات المكافأة.
          </p>
        )}

        {/* ---- وضع الاختبار (Mock) ---- */}
        <div className="p-4 rounded-2xl bg-surface border border-border space-y-3">
          <label className="flex items-center justify-between gap-2 text-xs font-bold">
            <span className="flex items-center gap-2">
              <FlaskConical className="size-4 text-primary" /> وضع الاختبار (بدون إعلانات حقيقية)
            </span>
            <input
              type="checkbox"
              checked={mock}
              onChange={(e) => {
                setMock(e.target.checked);
                setMockMode(e.target.checked);
              }}
              className="size-4 accent-[hsl(var(--primary))]"
            />
          </label>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            تجربة محلية لتدفق الإعلان والتحقق (SSV) دون أي إعلان حقيقي ودون أي تعديل على المحفظة أو بيانات المستخدمين.
          </p>
          {mock && (
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={locked}
                onClick={() => void runMock("verified")}
                className="py-2 rounded-xl bg-primary/15 text-xs font-bold disabled:opacity-50"
              >
                تحقق ناجح
              </button>
              <button
                type="button"
                disabled={locked}
                onClick={() => void runMock("failed")}
                className="py-2 rounded-xl bg-red-500/15 text-xs font-bold disabled:opacity-50"
              >
                فشل التحقق
              </button>
              <button
                type="button"
                disabled={locked}
                onClick={() => void runMock("cancelled")}
                className="py-2 rounded-xl bg-muted text-xs font-bold disabled:opacity-50"
              >
                إلغاء الإعلان
              </button>
            </div>
          )}
          {mockTxns.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {mockTxns.map((m) => (
                <div key={m.id} className="text-[11px] flex items-center justify-between gap-2">
                  <span className="truncate text-muted-foreground/80">{m.transaction_id}</span>
                  <StatusPill verification={m.verification_status} credit="not_credited" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---- سجل العمليات ---- */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <h3 className="text-sm font-bold text-muted-foreground">سجل المكافآت وحالة التحقق</h3>
            <span className="text-[10px] text-muted-foreground">
              مُضافة {stats.credited} · قيد التحقق {stats.pending} · فاشلة {stats.failed}
            </span>
          </div>

          {hasPending && (
            <div className="px-3 py-2 mb-3 rounded-xl bg-surface border border-border space-y-2">
              <label className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className={`size-3.5 ${autoRefresh ? "animate-spin [animation-duration:3s]" : ""}`} />
                  تحديث تلقائي لحالة «قيد المراجعة»
                </span>
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="size-4 accent-[hsl(var(--primary))]"
                />
              </label>
              {autoRefresh && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">تردد التحديث</span>
                  <div className="flex gap-1.5">
                    {REFRESH_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setRefreshSecs(s);
                          try {
                            localStorage.setItem(REFRESH_KEY, String(s));
                          } catch {
                            /* ignore */
                          }
                        }}
                        className={`px-3 py-1 rounded-xl text-[11px] font-bold border ${
                          refreshSecs === s
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border text-muted-foreground"
                        }`}
                      >
                        {s} ث
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* بحث وفلترة */}
          <div className="p-3 rounded-2xl bg-surface border border-border space-y-2 mb-3">
            <div className="relative">
              <Search className="size-4 absolute top-2.5 start-3 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث برقم العملية (transaction_id)"
                className="w-full ps-9 pe-3 py-2 rounded-xl bg-background border border-border text-xs outline-none focus:border-primary"
              />
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {([
                ["all", "الكل"],
                ["credited", "ناجح"],
                ["pending", "قيد"],
                ["failed", "فشل"],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={`py-1.5 rounded-xl text-[11px] font-bold border ${
                    statusFilter === key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] text-muted-foreground space-y-1">
                <span>من تاريخ</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-xl bg-background border border-border text-xs"
                />
              </label>
              <label className="text-[10px] text-muted-foreground space-y-1">
                <span>إلى تاريخ</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-xl bg-background border border-border text-xs"
                />
              </label>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[10px] text-muted-foreground">النتائج: {filtered.length}</span>
              <div className="flex items-center gap-2">
                {(query || statusFilter !== "all" || dateFrom || dateTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setStatusFilter("all");
                      setDateFrom("");
                      setDateTo("");
                    }}
                    className="px-3 py-1.5 rounded-xl bg-muted text-[11px] font-bold"
                  >
                    تصفير الفلترة
                  </button>
                )}
                <button
                  type="button"
                  onClick={downloadCsv}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary/15 text-[11px] font-bold"
                >
                  <Download className="size-3.5" /> تنزيل CSV
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {txns.length === 0 && <p className="text-xs text-muted-foreground px-1">لا توجد عمليات بعد.</p>}
            {txns.length > 0 && filtered.length === 0 && (
              <p className="text-xs text-muted-foreground px-1">لا توجد نتائج مطابقة للبحث أو الفلترة.</p>
            )}
            {filtered.map((t) => (
              <div key={t.id} className="p-3 rounded-2xl bg-surface border border-border text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold tabular-nums">
                    {t.credit_status === "credited" ? `+${Number(t.reward_amount).toFixed(4)}` : "0.0000"}
                  </span>
                  <StatusPill verification={t.verification_status} credit={t.credit_status} />
                </div>
                <div className="mt-1 text-muted-foreground">{new Date(t.occurred_at).toLocaleString("ar")}</div>
                <div className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">
                  رقم العملية: {t.transaction_id}
                </div>
                <p className="text-[10px] text-muted-foreground/80 mt-1.5 leading-relaxed">{statusDetail(t)}</p>
                <div className="text-[10px] text-muted-foreground/60 mt-1">
                  حالة التحقق: {t.verification_status} · حالة الرصيد: {t.credit_status}
                </div>
                {statusKey(t) === "pending" && (
                  <button
                    type="button"
                    onClick={() => void recheck(t)}
                    disabled={recheckId === t.id}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary/15 text-[11px] font-bold disabled:opacity-50"
                  >
                    {recheckId === t.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                    إعادة محاولة جلب حالة التحقق
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </AppShell>
  );
}
