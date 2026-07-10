import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Profile } from "@/lib/use-auth";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { ArrowRight, MessageCircle, UserPlus, Check, X, UserCheck, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/profile/$userId")({
  component: UserProfilePage,
});

type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
};

function UserProfilePage() {
  const { userId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [p, setP] = useState<Profile | null>(null);
  const [friendship, setFriendship] = useState<Friendship | null>(null);

  async function loadFriendship() {
    if (!user) return;
    const { data } = await supabase
      .from("friendships")
      .select("*")
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${user.id})`)
      .maybeSingle();
    setFriendship(data as Friendship | null);
  }

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      setP(data as Profile);
    })();
    void loadFriendship();
  }, [userId, user]);

  async function addFriend() {
    if (!user || !p) return;
    const { error } = await supabase.from("friendships").insert({ requester_id: user.id, addressee_id: p.id });
    if (error?.code === "23505") toast.error("سبق أن أرسلت طلب صداقة");
    else if (error) toast.error("تعذر إرسال الطلب");
    else { toast.success("تم إرسال طلب الصداقة"); void loadFriendship(); }
  }

  async function acceptFriend() {
    if (!friendship) return;
    const prev = friendship;
    setFriendship({ ...friendship, status: "accepted" });
    const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", friendship.id);
    if (error) { toast.error("تعذر القبول"); setFriendship(prev); }
    else toast.success("تمت إضافة الصديق ✅");
  }

  async function rejectFriend() {
    if (!friendship) return;
    const prev = friendship;
    setFriendship(null);
    const { error } = await supabase.from("friendships").delete().eq("id", friendship.id);
    if (error) { toast.error("تعذر الرفض"); setFriendship(prev); }
    else toast.success("تم رفض الطلب");
  }

  if (!p) return <div className="min-h-dvh flex items-center justify-center text-muted-foreground">جاري التحميل...</div>;

  const isSelf = user?.id === p.id;
  const incomingPending = friendship?.status === "pending" && friendship?.addressee_id === user?.id;
  const outgoingPending = friendship?.status === "pending" && friendship?.requester_id === user?.id;
  const accepted = friendship?.status === "accepted";

  return (
    <AppShell>
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border px-3 py-2.5 flex items-center gap-3">
        <button onClick={() => navigate({ to: ".." as any })} className="p-1.5 -mr-2 text-muted-foreground"><ArrowRight className="size-4" /></button>
        <h1 className="font-bold text-sm">الملف الشخصي</h1>
      </header>

      <div className="p-6 flex flex-col items-center gap-3 bg-gradient-to-b from-primary/10 to-transparent">
        <Avatar profile={p} size="xl" ring={false} />
        <h2 className="text-2xl font-bold" style={{ color: p.name_color }}>{p.username}</h2>
        <p className="text-sm text-muted-foreground">{p.gender === "female" ? "أنثى" : "ذكر"} {p.age && `• ${p.age} سنة`} {p.is_guest && "• زائر"}</p>
        {p.bio && <p className="text-sm text-foreground italic text-center max-w-sm">"{p.bio}"</p>}
        <p className="text-[10px] text-muted-foreground font-mono">ID: {p.id.slice(0, 8)}</p>
      </div>

      {!isSelf && (
        <div className="p-4 space-y-3">
          {incomingPending && (
            <div className="bg-primary/10 border border-primary/30 rounded-2xl p-3 space-y-2">
              <p className="text-xs font-bold text-center">أرسل لك طلب صداقة 💌</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={acceptFriend} className="py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1">
                  <Check className="size-3.5" /> قبول
                </button>
                <button onClick={rejectFriend} className="py-2 rounded-xl bg-background border border-border text-xs font-bold flex items-center justify-center gap-1">
                  <X className="size-3.5" /> رفض
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Link to="/messages/$userId" params={{ userId: p.id }} className="bg-surface border border-border rounded-2xl p-3 flex flex-col items-center gap-1.5">
              <MessageCircle className="size-4 text-secondary" />
              <span className="text-xs font-bold">رسالة خاصة</span>
            </Link>
            {accepted ? (
              <div className="bg-surface border border-primary/40 rounded-2xl p-3 flex flex-col items-center gap-1.5">
                <UserCheck className="size-4 text-primary" />
                <span className="text-xs font-bold">صديق</span>
              </div>
            ) : outgoingPending ? (
              <button onClick={rejectFriend} className="bg-surface border border-border rounded-2xl p-3 flex flex-col items-center gap-1.5">
                <Clock className="size-4 text-muted-foreground" />
                <span className="text-xs font-bold">إلغاء الطلب</span>
              </button>
            ) : !incomingPending ? (
              <button onClick={addFriend} className="bg-surface border border-border rounded-2xl p-3 flex flex-col items-center gap-1.5">
                <UserPlus className="size-4 text-primary" />
                <span className="text-xs font-bold">طلب صداقة</span>
              </button>
            ) : null}
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
          <Stat label="الحالة" value={p.is_online ? "متصل الآن" : "غير متصل"} />
          <Stat label="نوع الحساب" value={p.is_guest ? "زائر" : "عضو"} />
          <Stat label="تاريخ الانضمام" value={new Date(p.created_at).toLocaleDateString("ar")} />
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
