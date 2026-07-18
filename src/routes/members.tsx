import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Profile } from "@/lib/use-auth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { UserActionsDialog } from "@/components/UserActions";
import { Search } from "lucide-react";

export const Route = createFileRoute("/members")({
  head: () => ({ meta: [{ title: "المتصلون - شات عالمي" }] }),
  component: MembersPage,
});

type Filter = "all" | "male" | "female" | "guest" | "member";

function MembersPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Profile | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,username,avatar_url,name_color,text_color,is_guest,gender,age,is_online,last_seen")
        .order("last_seen", { ascending: false })
        .limit(120);
      if (data) setProfiles(data as Profile[]);
    })();
  }, []);

  const filtered = profiles.filter((p) => {
    if (query && !p.username.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === "male" && p.gender !== "male") return false;
    if (filter === "female" && p.gender !== "female") return false;
    if (filter === "guest" && !p.is_guest) return false;
    if (filter === "member" && p.is_guest) return false;
    return true;
  });

  return (
    <AppShell>
      <PageHeader title="المتصلون" subtitle={`${filtered.length} عضو`} />

      <div className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث باسم المستخدم..."
            className="w-full bg-surface border border-border rounded-full pr-10 pl-4 py-2.5 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {([
            ["all", "الكل"],
            ["male", "ذكر"],
            ["female", "أنثى"],
            ["member", "أعضاء"],
            ["guest", "زوار"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${filter === k ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground border border-border"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-8">
        <div className="grid grid-cols-3 gap-3">
          {filtered.map((p) => (
            <button key={p.id} onClick={() => setSelected(p)} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-surface border border-border hover:border-primary/40 transition-all">
              <Avatar profile={p} size="lg" ring={false} />
              <span className="text-xs font-bold truncate w-full text-center" style={{ color: p.name_color }}>{p.username}</span>
              <span className="text-[9px] text-muted-foreground">{p.gender === "female" ? "أنثى" : "ذكر"} {p.is_guest && "• زائر"}</span>
            </button>
          ))}
        </div>
        {filtered.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">لا توجد نتائج</p>}
      </div>

      <UserActionsDialog profile={selected} open={!!selected} onOpenChange={(v) => !v && setSelected(null)} />
    </AppShell>
  );
}
