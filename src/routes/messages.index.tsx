import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Profile } from "@/lib/use-auth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";

export const Route = createFileRoute("/messages/")({
  head: () => ({ meta: [{ title: "الرسائل الخاصة - شات عالمي" }] }),
  component: MessagesList,
});

type Conv = { partner: Profile; lastMessage: string; lastAt: string; unread: number };

function MessagesList() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [convs, setConvs] = useState<Conv[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("private_messages")
        .select("sender_id,receiver_id,content,created_at,read")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!data) return;
      const partnerMap = new Map<string, Conv>();
      for (const m of data) {
        const partnerId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
        if (!partnerMap.has(partnerId)) {
          partnerMap.set(partnerId, {
            partner: { id: partnerId } as Profile,
            lastMessage: m.content,
            lastAt: m.created_at,
            unread: 0,
          });
        }
        if (m.receiver_id === user.id && !m.read) {
          partnerMap.get(partnerId)!.unread++;
        }
      }
      const ids = [...partnerMap.keys()];
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,username,avatar_url,name_color,text_color,is_guest")
          .in("id", ids);
        for (const p of profs ?? []) {
          if (partnerMap.has(p.id)) partnerMap.get(p.id)!.partner = p as Profile;
        }
      }
      setConvs([...partnerMap.values()]);
    })();
  }, [user]);

  return (
    <AppShell>
      <PageHeader title="الرسائل الخاصة" subtitle={`${convs.length} محادثة`} />
      <div className="p-4 space-y-2">
        {convs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">لا توجد رسائل بعد. اضغط على صورة أي مستخدم لبدء محادثة</div>
        )}
        {convs.map((c) => (
          <Link
            key={c.partner.id}
            to="/messages/$userId"
            params={{ userId: c.partner.id }}
            className="flex items-center gap-3 p-3 rounded-2xl bg-surface border border-border hover:border-primary/40"
          >
            <Avatar profile={c.partner} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm" style={{ color: c.partner.name_color }}>{c.partner.username}</h4>
                <span className="text-[10px] text-muted-foreground">{new Date(c.lastAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-1">{c.lastMessage}</p>
            </div>
            {c.unread > 0 && <span className="size-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">{c.unread}</span>}
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
