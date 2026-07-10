import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Profile } from "@/lib/use-auth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Check, X, MessageCircle, UserPlus, Bell } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "مركز الإشعارات - شات عالمي" }] }),
  component: NotificationsCenter,
});

type UnreadPM = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: Profile;
};

type FriendReq = {
  id: string;
  requester_id: string;
  created_at: string;
  requester?: Profile;
};

function NotificationsCenter() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [pms, setPms] = useState<UnreadPM[]>([]);
  const [reqs, setReqs] = useState<FriendReq[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  async function refresh() {
    if (!user) return;
    const [{ data: mData }, { data: fData }] = await Promise.all([
      supabase
        .from("private_messages")
        .select("id, sender_id, content, created_at")
        .eq("receiver_id", user.id)
        .eq("read", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("friendships")
        .select("id, requester_id, created_at")
        .eq("addressee_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);
    const ids = new Set<string>([
      ...(mData ?? []).map((m) => m.sender_id),
      ...(fData ?? []).map((f) => f.requester_id),
    ]);
    let profMap = new Map<string, Profile>();
    if (ids.size) {
      const { data: profs } = await supabase.from("profiles").select("*").in("id", [...ids]);
      profMap = new Map((profs ?? []).map((p) => [p.id, p as Profile]));
    }
    setPms((mData ?? []).map((m) => ({ ...m, sender: profMap.get(m.sender_id) })));
    setReqs((fData ?? []).map((f) => ({ ...f, requester: profMap.get(f.requester_id) })));
  }

  useEffect(() => {
    if (!user) return;
    void refresh();
    const ch = supabase
      .channel(`notif-center:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "private_messages", filter: `receiver_id=eq.${user.id}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships", filter: `addressee_id=eq.${user.id}` }, () => void refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  async function accept(f: FriendReq) {
    setBusy(f.id);
    setReqs((prev) => prev.filter((x) => x.id !== f.id));
    const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", f.id);
    if (error) { toast.error("تعذر القبول"); void refresh(); }
    else toast.success("تمت إضافة الصديق ✅");
    setBusy(null);
  }

  async function reject(f: FriendReq) {
    setBusy(f.id);
    setReqs((prev) => prev.filter((x) => x.id !== f.id));
    const { error } = await supabase.from("friendships").delete().eq("id", f.id);
    if (error) { toast.error("تعذر الرفض"); void refresh(); }
    else toast.success("تم رفض الطلب");
    setBusy(null);
  }

  const total = pms.length + reqs.length;

  return (
    <AppShell>
      <PageHeader title="مركز الإشعارات" subtitle={total ? `${total} عنصر جديد` : "لا يوجد جديد"} />

      <div className="p-4 space-y-6">
        {total === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Bell className="size-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">لا توجد إشعارات جديدة ✨</p>
          </div>
        )}

        {reqs.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-bold text-secondary flex items-center gap-1.5">
              <UserPlus className="size-3.5" /> طلبات الصداقة ({reqs.length})
            </h3>
            {reqs.map((f) => (
              <div key={f.id} className="flex items-center gap-3 p-3 rounded-2xl bg-surface border border-primary/30">
                <Link to="/profile/$userId" params={{ userId: f.requester_id }}>
                  {f.requester && <Avatar profile={f.requester} size="md" />}
                </Link>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color: f.requester?.name_color }}>
                    {f.requester?.username ?? "..."}
                  </p>
                  <p className="text-[10px] text-muted-foreground">أرسل طلب صداقة</p>
                </div>
                <button
                  onClick={() => accept(f)}
                  disabled={busy === f.id}
                  className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50"
                  aria-label="قبول"
                >
                  <Check className="size-3.5" />
                </button>
                <button
                  onClick={() => reject(f)}
                  disabled={busy === f.id}
                  className="size-8 rounded-full bg-background border border-border flex items-center justify-center disabled:opacity-50"
                  aria-label="رفض"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </section>
        )}

        {pms.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-bold text-secondary flex items-center gap-1.5">
              <MessageCircle className="size-3.5" /> رسائل غير مقروءة ({pms.length})
            </h3>
            {pms.map((m) => (
              <Link
                key={m.id}
                to="/messages/$userId"
                params={{ userId: m.sender_id }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-surface border border-border hover:border-primary/40"
              >
                {m.sender && <Avatar profile={m.sender} size="md" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-sm truncate" style={{ color: m.sender?.name_color }}>
                      {m.sender?.username ?? "..."}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(m.created_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{m.content}</p>
                </div>
                <span className="text-[9px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">جديد</span>
              </Link>
            ))}
          </section>
        )}
      </div>
    </AppShell>
  );
}
