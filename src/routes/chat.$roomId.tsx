import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Profile } from "@/lib/use-auth";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { UserActionsDialog } from "@/components/UserActions";
import { ArrowRight, Send, Loader2, X, CornerUpLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/chat/$roomId")({
  component: ChatRoom,
});

type Msg = {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  reply_to_id?: string | null;
  reply_snippet?: string | null;
  reply_username?: string | null;
  profile?: Profile;
};

function ChatRoom() {
  const { roomId } = Route.useParams();
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<{ name: string; icon: string | null; color: string | null } | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    void (async () => {
      const { data: r } = await supabase.from("rooms").select("name,icon,color").eq("id", roomId).maybeSingle();
      setRoom(r);
      const { data: msgs } = await supabase
        .from("messages")
        .select("id, content, user_id, created_at, reply_to_id, reply_snippet, reply_username")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(100);
      if (msgs) {
        const userIds = [...new Set(msgs.map((m) => m.user_id))];
        const { data: profs } = await supabase.from("profiles").select("*").in("id", userIds);
        const map = new Map((profs ?? []).map((p) => [p.id, p as Profile]));
        setMessages(msgs.map((m) => ({ ...m, profile: map.get(m.user_id) })));
      }
    })();
  }, [roomId]);

  useEffect(() => {
    const channel = supabase
      .channel(`room:${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` }, async (payload) => {
        const m = payload.new as any;
        const { data: p } = await supabase.from("profiles").select("*").eq("id", m.user_id).maybeSingle();
        setMessages((prev) => [...prev, { ...m, profile: p as Profile }]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !user) return;
    setSending(true);
    const text = input.trim();
    const currentReply = replyTo;
    setInput("");
    setReplyTo(null);
    const { error } = await supabase.from("messages").insert({
      room_id: roomId,
      user_id: user.id,
      content: text,
      reply_to_id: currentReply?.id ?? null,
      reply_snippet: currentReply ? currentReply.content.slice(0, 80) : null,
      reply_username: currentReply?.profile?.username ?? null,
    });
    if (error) {
      toast.error("تعذر الإرسال");
      setInput(text);
      setReplyTo(currentReply);
    }
    setSending(false);
  }

  function onUsernameClick(m: Msg) {
    if (m.user_id === user?.id) return;
    setReplyTo(m);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  if (loading || !profile) return <div className="min-h-dvh flex items-center justify-center text-muted-foreground">جاري التحميل...</div>;

  return (
    <AppShell hideNav>
      <div className="flex flex-col h-dvh max-w-md mx-auto">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border px-3 py-3 flex items-center gap-3">
          <Link to="/" className="p-2 -mr-2 text-muted-foreground"><ArrowRight className="size-5" /></Link>
          <div className="size-10 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: `${room?.color ?? "#8b5cf6"}33` }}>{room?.icon ?? "💬"}</div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm truncate">{room?.name ?? "..."}</h1>
            <p className="text-[10px] text-secondary">متصل الآن</p>
          </div>
        </header>

        {/* Welcome banner */}
        <div className="px-4 pt-4">
          <div className="bg-gradient-to-l from-primary/20 to-secondary/20 border border-primary/30 px-4 py-2.5 rounded-2xl text-center text-[11px] font-semibold">
            مرحباً بك في {room?.name}! يرجى الالتزام بالاحترام المتبادل 📜
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-8">لا توجد رسائل بعد. كن أول من يكتب! ✨</div>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} isSelf={m.user_id === user?.id} onAvatarClick={(p) => setSelectedProfile(p)} />
          ))}
        </div>

        {/* Input */}
        <form onSubmit={send} className="p-3 bg-surface border-t border-border">
          <div className="flex items-center gap-2 bg-background border border-border rounded-full p-1 pr-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب رسالتك هنا..."
              maxLength={500}
              className="flex-1 bg-transparent py-2 text-sm focus:outline-none"
            />
            <button type="submit" disabled={sending || !input.trim()} className="size-10 rounded-full gradient-brand flex items-center justify-center text-white disabled:opacity-50">
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 rotate-180" />}
            </button>
          </div>
        </form>
      </div>

      <UserActionsDialog profile={selectedProfile} open={!!selectedProfile} onOpenChange={(v) => !v && setSelectedProfile(null)} />
    </AppShell>
  );
}

function MessageBubble({ msg, isSelf, onAvatarClick }: { msg: Msg; isSelf: boolean; onAvatarClick: (p: Profile) => void }) {
  const p = msg.profile;
  if (!p) return null;
  return (
    <div className={`flex gap-2 items-end ${isSelf ? "flex-row-reverse" : ""}`}>
      <Avatar profile={p} size="sm" onClick={() => onAvatarClick(p)} />
      <div className="flex flex-col max-w-[75%]">
        <span className="text-[10px] font-bold mb-1 px-1" style={{ color: p.name_color }}>
          {p.username} {p.age && <span className="text-muted-foreground font-normal">• {p.age}</span>}
        </span>
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed border ${isSelf ? "bg-primary/15 border-primary/30 rounded-bl-none" : "bg-surface border-border rounded-br-none"}`}
          style={{ color: p.text_color }}
        >
          {msg.content}
        </div>
      </div>
    </div>
  );
}
