import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { FAILURE_REASON_LABELS } from "@/lib/ssv-binding";
import { ownerApproveReward, ownerRejectReward } from "@/lib/ssv-admin.functions";

export const Route = createFileRoute("/ssv-monitor")({
  head: () => ({
    meta: [
      { title: "متابعة عمليات التحقق - شات عالمي" },
      {
        name: "description",
        content: "صفحة المالك لمتابعة عمليات التحقق من مشاهدة الإعلانات لكل مستخدم مع اعتماد أو رفض يدوي.",
      },
      { property: "og:title", content: "متابعة عمليات التحقق - شات عالمي" },
      {
        property: "og:description",
        content: "متابعة عمليات SSV حسب المستخدم مع إجراءات تحقق يدوية عند فشل التحقق التلقائي.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SsvMonitorPage,
});

/** A view with no SSV reply after this long is treated as "no reply" and needs action. */
const NO_REPLY_AFTER_MS = 10 * 60 * 1000;

type ViewRow = { transaction_id: string; user_id: string; created_at: string };
type TxRow = {
  transaction_id: string;
  user_id: string;
  reward_amount: number;
  verification_status: string;
  credit_status: string;
  failure_reason: string | null;
  manual_action: string | null;
  manual_at: string | null;
  updated_at: string;
};
type Status = "credited" | "pending" | "no_reply" | "failed";
type Item = { id: string; userId: string; at: string; status: Status; tx: TxRow | null };

const STATUS_LABEL: Record<Status, string> = {
  credited: "ناجح — أُضيف الرصيد",
  pending: "قيد المراجعة",
  no_reply: "لم يصل التحقق",
  failed: "فشل التحقق",
};

function statusOf(view: ViewRow | null, tx: TxRow | null): Status {
  if (tx?.credit_status === "credited") return "credited";
  if (tx && (tx.verification_status === "failed" || tx.verification_status === "cancelled")) return "failed";
  const at = new Date(view?.created_at ?? tx?.updated_at ?? Date.now()).getTime();
  return Date.now() - at > NO_REPLY_AFTER_MS ? "no_reply" : "pending";
}

function SsvMonitorPage() {
  const { user, profile } = useAuth();
  const approve = useServerFn(ownerApproveReward);
  const reject = useServerFn(ownerRejectReward);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "action" | Status>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<{ id: string; kind: "approve" | "reject" } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      setAllowed(false);
      setLoading(false);
      return;
    }
    setAllowed(true);
    const [{ data: views }, { data: txs }] = await Promise.all([
      supabase
        .from("ad_view_requests")
        .select("transaction_id,user_id,created_at")
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("ad_reward_transactions")
        .select(
          "transaction_id,user_id,reward_amount,verification_status,credit_status,failure_reason,manual_action,manual_at,updated_at",
        )
        .order("updated_at", { ascending: false })
        .limit(300),
    ]);
    const txMap = new Map<string, TxRow>();
    for (const t of (txs ?? []) as TxRow[]) txMap.set(t.transaction_id, t);
    const seen = new Set<string>();
    const list: Item[] = [];
    for (const v of (views ?? []) as ViewRow[]) {
      const tx = txMap.get(v.transaction_id) ?? null;
      seen.add(v.transaction_id);
      list.push({ id: v.transaction_id, userId: v.user_id, at: v.created_at, status: statusOf(v, tx), tx });
    }
    for (const t of txMap.values()) {
      if (seen.has(t.transaction_id)) continue;
      list.push({ id: t.transaction_id, userId: t.user_id, at: t.updated_at, status: statusOf(null, t), tx: t });
    }
    setItems(list);

    const ids = Array.from(new Set(list.map((i) => i.userId)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,username").in("id", ids);
      const map: Record<string, string> = {};
      for (const p of profs ?? []) map[p.id] = p.username;
      setNames(map);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
    const t = setInterval(() => {
      if (!document.hidden) void load();
    }, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const by = new Map<string, Item[]>();
    for (const it of items) {
      const needsAction = it.status === "failed" || it.status === "no_reply";
      if (filter === "action" && !needsAction) continue;
      if (filter !== "all" && filter !== "action" && it.status !== filter) continue;
      const name = (names[it.userId] ?? "").toLowerCase();
      if (q && !name.includes(q) && !it.id.toLowerCase().includes(q) && !it.userId.includes(q)) continue;
      const arr = by.get(it.userId) ?? [];
      arr.push(it);
      by.set(it.userId, arr);
    }
    return Array.from(by.entries())
      .map(([userId, list]) => ({
        userId,
        list,
        credited: list.filter((i) => i.status === "credited").length,
        pending: list.filter((i) => i.status === "pending").length,
        action: list.filter((i) => i.status === "failed" || i.status === "no_reply").length,
        earned: list.reduce((s, i) => s + (i.status === "credited" ? Number(i.tx?.reward_amount ?? 0) : 0), 0),
      }))
      .sort((a, b) => b.action - a.action || b.list.length - a.list.length);
  }, [items, names, query, filter]);

  const totals = useMemo(
    () => ({
      credited: items.filter((i) => i.status === "credited").length,
      pending: items.filter((i) => i.status === "pending").length,
      action: items.filter((i) => i.status === "failed" || i.status === "no_reply").length,
    }),
    [items],
  );

  const act = async (id: string, kind: "approve" | "reject") => {
    setActingId(id);
    setConfirmId(null);
    try {
      if (kind === "approve") {
        const r = await approve({ data: { transactionId: id } });
        if (r.ok) toast.success(`تم الاعتماد اليدوي وأُضيف ${Number(r.reward ?? 0).toFixed(4)} إلى محفظة المستخدم.`);
        else if (r.message === "already_credited") toast.info("هذه العملية مُضافة مسبقًا، لم يُضف رصيد مرة أخرى.");
        else if (r.message === "no_view_request") toast.error("لا يوجد طلب مشاهدة مسجّل لهذه العملية.");
        else if (r.message === "user_mismatch") toast.error("المستخدم لا يطابق صاحب طلب المشاهدة.");
        else toast.error("تعذّر الاعتماد اليدوي.");
      } else {
        const r = await reject({ data: { transactionId: id } });
        if (r.ok) toast.success("تم رفض العملية، ولم يُضف أي رصيد.");
        else if (r.message === "already_credited") toast.info("العملية مُضافة مسبقًا ولا يمكن رفضها.");
        else toast.error("تعذّر رفض العملية.");
      }
      await load();
    } catch {
      toast.error("حدث خطأ أثناء تنفيذ الإجراء.");
    } finally {
      setActingId(null);
    }
  };

  if (!profile) return null;

  if (allowed === false) {
    return (
      <AppShell>
        <PageHeader title="متابعة عمليات التحقق" />
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
      <PageHeader
        title="متابعة عمليات التحقق"
        subtitle="عمليات SSV حسب كل مستخدم"
        right={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="p-2 rounded-xl bg-primary/15 disabled:opacity-50"
            aria-label="تحديث"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        }
      />

      <div className="p-4 space-y-3">
        {allowed === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-2xl bg-surface border border-border">
                <ShieldCheck className="size-4 mx-auto text-emerald-400" />
                <p className="text-lg font-bold tabular-nums mt-1">{totals.credited}</p>
                <p className="text-[10px] text-muted-foreground">ناجحة</p>
              </div>
              <div className="p-3 rounded-2xl bg-surface border border-border">
                <Clock className="size-4 mx-auto text-amber-400" />
                <p className="text-lg font-bold tabular-nums mt-1">{totals.pending}</p>
                <p className="text-[10px] text-muted-foreground">قيد المراجعة</p>
              </div>
              <div className="p-3 rounded-2xl bg-surface border border-border">
                <ShieldAlert className="size-4 mx-auto text-red-400" />
                <p className="text-lg font-bold tabular-nums mt-1">{totals.action}</p>
                <p className="text-[10px] text-muted-foreground">تحتاج إجراء</p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-border">
              <Search className="size-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث باسم المستخدم أو رقم العملية"
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto">
              {(
                [
                  ["all", "الكل"],
                  ["action", "تحتاج إجراء"],
                  ["pending", "قيد المراجعة"],
                  ["credited", "ناجحة"],
                  ["failed", "فاشلة"],
                  ["no_reply", "لم يصل التحقق"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold ${
                    filter === k ? "bg-primary text-primary-foreground" : "bg-surface border border-border"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {groups.length === 0 && (
              <p className="text-center text-[11px] text-muted-foreground py-6">لا توجد عمليات مطابقة.</p>
            )}

            {groups.map((g) => (
              <div key={g.userId} className="rounded-2xl bg-surface border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen(open === g.userId ? null : g.userId)}
                  className="w-full p-3 flex items-center justify-between gap-2 text-start"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{names[g.userId] ?? "مستخدم"}</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {g.list.length} عملية · ناجحة {g.credited} · قيد {g.pending} · تحتاج إجراء {g.action} · الرصيد المضاف{" "}
                      {g.earned.toFixed(4)}
                    </p>
                  </div>
                  <ChevronDown className={`size-4 shrink-0 transition-transform ${open === g.userId ? "rotate-180" : ""}`} />
                </button>

                {open === g.userId && (
                  <div className="border-t border-border divide-y divide-border">
                    {g.list.map((it) => {
                      const needsAction = it.status === "failed" || it.status === "no_reply";
                      const reason = it.tx?.failure_reason
                        ? (FAILURE_REASON_LABELS[it.tx.failure_reason] ?? it.tx.failure_reason)
                        : it.status === "no_reply"
                          ? "لم يصل رد التحقق من AdMob"
                          : null;
                      return (
                        <div key={it.id} className="p-3 space-y-2 text-[11px]">
                          <div className="flex items-center justify-between gap-2">
                            <code dir="ltr" className="text-[10px] text-muted-foreground truncate">
                              {it.id}
                            </code>
                            <span
                              className={`shrink-0 font-bold ${
                                it.status === "credited"
                                  ? "text-emerald-400"
                                  : it.status === "pending"
                                    ? "text-amber-400"
                                    : "text-red-400"
                              }`}
                            >
                              {STATUS_LABEL[it.status]}
                            </span>
                          </div>
                          <p className="text-muted-foreground">
                            {new Date(it.at).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" })}
                            {it.status === "credited" && ` · ${Number(it.tx?.reward_amount ?? 0).toFixed(4)}`}
                            {it.tx?.manual_action === "approved" && " · اعتُمدت يدويًا"}
                            {it.tx?.manual_action === "rejected" && " · رُفضت يدويًا"}
                          </p>
                          {reason && <p className="text-red-400/90">السبب: {reason}</p>}

                          {needsAction && (
                            <div className="flex gap-2">
                              {confirmId?.id === it.id ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void act(it.id, confirmId.kind)}
                                    className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground font-bold"
                                  >
                                    {confirmId.kind === "approve" ? "تأكيد الاعتماد وإضافة الرصيد" : "تأكيد الرفض"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmId(null)}
                                    className="px-3 py-2 rounded-xl bg-background border border-border font-bold"
                                  >
                                    إلغاء
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    disabled={actingId === it.id}
                                    onClick={() => setConfirmId({ id: it.id, kind: "approve" })}
                                    className="flex-1 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                                  >
                                    {actingId === it.id ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="size-3.5" />
                                    )}
                                    تحقق يدوي واعتماد
                                  </button>
                                  {it.status === "no_reply" && (
                                    <button
                                      type="button"
                                      disabled={actingId === it.id}
                                      onClick={() => setConfirmId({ id: it.id, kind: "reject" })}
                                      className="flex-1 py-2 rounded-xl bg-red-500/15 text-red-400 font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                                    >
                                      <XCircle className="size-3.5" /> رفض
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
              الاعتماد اليدوي يضيف المكافأة لصاحب طلب المشاهدة فقط، ومرة واحدة لكل عملية. استخدمه بعد التأكد من المشاهدة في
              تقارير AdMob. المستخدم يتلقى إشعارًا داخل التطبيق بالنتيجة.
            </p>

            <Link
              to="/ads-admin"
              className="block text-center py-2.5 rounded-2xl bg-primary/10 text-xs font-bold text-primary"
            >
              العودة إلى لوحة الإعلانات
            </Link>
          </>
        )}
      </div>
    </AppShell>
  );
}
