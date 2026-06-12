import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Profile } from "@/lib/use-auth";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { ArrowRight, MessageCircle, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/profile/$userId")({
  component: UserProfilePage,
});

function UserProfilePage() {
  const { userId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [p, setP] = useState<Profile | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      setP(data as Profile);
    })();
  }, [userId]);

  async function addFriend() {
    if (!user || !p) return;
    const { error } = await supabase.from("friendships").insert({ requester_id: user.id, addressee_id: p.id });
    if (error?.code === "23505") toast.error("سبق أن أرسلت طلب صداقة");
    else if (error) toast.error("تعذر إرسال الطلب");
    else toast.success("تم إرسال طلب الصداقة");
  }

  if (!p) return <div className="min-h-dvh flex items-center justify-center text-muted-foreground">جاري التحميل...</div>;

  const isSelf = user?.id === p.id;

  return (
    <AppShell>
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border px-3 py-3 flex items-center gap-3">
        <button onClick={() => navigate({ to: ".." as any })} className="p-2 -mr-2 text-muted-foreground"><ArrowRight className="size-5" /></button>
        <h1 className="font-bold">الملف الشخصي</h1>
      </header>

      <div className="p-6 flex flex-col items-center gap-3 bg-gradient-to-b from-primary/10 to-transparent">
        <Avatar profile={p} size="xl" ring={false} />
        <h2 className="text-2xl font-bold" style={{ color: p.name_color }}>{p.username}</h2>
        <p className="text-sm text-muted-foreground">{p.gender === "female" ? "أنثى" : "ذكر"} {p.age && `• ${p.age} سنة`} {p.is_guest && "• زائر"}</p>
        {p.bio && <p className="text-sm text-foreground italic text-center max-w-sm">"{p.bio}"</p>}
        <p className="text-[10px] text-muted-foreground font-mono">ID: {p.id.slice(0, 8)}</p>
      </div>

      {!isSelf && (
        <div className="p-4 grid grid-cols-2 gap-3">
          <Link to="/messages/$userId" params={{ userId: p.id }} className="bg-surface border border-border rounded-2xl p-4 flex flex-col items-center gap-2">
            <MessageCircle className="size-6 text-secondary" />
            <span className="text-sm font-bold">رسالة خاصة</span>
          </Link>
          <button onClick={addFriend} className="bg-surface border border-border rounded-2xl p-4 flex flex-col items-center gap-2">
            <UserPlus className="size-6 text-primary" />
            <span className="text-sm font-bold">طلب صداقة</span>
          </button>
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
