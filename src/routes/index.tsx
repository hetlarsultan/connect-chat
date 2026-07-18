import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { ChevronLeft, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "غرف الدردشة - شات عالمي" },
      { name: "description", content: "تصفح جميع غرف الدردشة المتاحة وانضم للحوار" },
    ],
  }),
  component: RoomsPage,
});

type Room = { id: string; name: string; description: string | null; icon: string | null; color: string | null; member_count?: number };

function RoomsPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    void (async () => {
      const [{ data }, { count }] = await Promise.all([
        supabase.from("rooms").select("id,name,description,icon,color").order("created_at"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_online", true),
      ]);
      if (data) {
        setRooms(data.map((r) => ({ ...r, member_count: 5 + (r.id.charCodeAt(0) % 45) })));
      }
      setOnlineCount(count ?? 0);
    })();
  }, []);

  if (loading || !profile) {
    return <div className="min-h-dvh flex items-center justify-center text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <AppShell>
      <PageHeader
        title={`أهلاً، ${profile.username}`}
        subtitle={`${onlineCount} متصل الآن`}
        right={
          <Link to="/members" className="flex items-center gap-1.5 bg-surface px-3 py-1.5 rounded-full text-xs text-secondary">
            <Users className="size-3.5" /> المتصلون
          </Link>
        }
      />

      {/* Welcome banner */}
      <div className="mx-4 mt-4 p-5 rounded-3xl gradient-brand glow-primary relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-white text-xl font-bold">مرحباً بك في عالمك! 🌍</h2>
          <p className="text-white/90 text-xs mt-1">انضم للدردشة العامة والتقِ أصدقاء جدد</p>
          <Link to="/chat/$roomId" params={{ roomId: rooms[0]?.id ?? "" }} className="mt-3 inline-flex bg-white text-primary text-xs font-bold px-4 py-2 rounded-full">
            دخول الدردشة العامة
          </Link>
        </div>
        <div className="absolute -left-4 -bottom-4 size-32 bg-white/10 rounded-full blur-3xl" />
      </div>

      <div className="px-4 mt-8">
        <h3 className="text-sm font-bold text-muted-foreground mb-3 px-1">جميع الغرف</h3>
        <div className="space-y-3">
          {rooms.map((room) => (
            <Link
              key={room.id}
              to="/chat/$roomId"
              params={{ roomId: room.id }}
              className="block p-4 rounded-2xl bg-surface border border-border hover:border-primary/40 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div
                  className="size-16 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-lg"
                  style={{ backgroundColor: `${room.color}33`, boxShadow: `0 4px 20px ${room.color}22` }}
                >
                  {room.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-foreground">{room.name}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{room.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="size-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[10px] text-secondary font-semibold">{room.member_count} متصل</span>
                  </div>
                </div>
                <ChevronLeft className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
