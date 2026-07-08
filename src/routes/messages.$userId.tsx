import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Profile } from "@/lib/use-auth";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { ArrowRight, Send, Loader2, ImagePlus, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { uploadPrivateImage, getPrivateImageUrl, deletePrivateImage } from "@/lib/storage";

export const Route = createFileRoute("/messages/$userId")({
  component: PrivateChat,
});

type PM = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
  image_path: string | null;
  viewed_at: string | null;
};

function PrivateChat() {
  const { userId: partnerId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [partner, setPartner] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<PM[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", partnerId).maybeSingle();
      setPartner(p as Profile);
      const { data: msgs } = await supabase
        .from("private_messages")
        .select("*")
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
        .order("created_at", { ascending: true });
      if (msgs) setMessages(msgs as PM[]);
      await supabase.from("private_messages").update({ read: true }).eq("sender_id", partnerId).eq("receiver_id", user.id).eq("read", false);
    })();
  }, [user, partnerId]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`pm:${user.id}:${partnerId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "private_messages" }, (payload) => {
        const m = payload.new as PM;
        if ((m.sender_id === user.id && m.receiver_id === partnerId) || (m.sender_id === partnerId && m.receiver_id === user.id)) {
          setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "private_messages" }, (payload) => {
        const m = payload.new as PM;
        setMessages((prev) => prev.map((x) => x.id === m.id ? { ...x, ...m } : x));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, partnerId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !user) return;
    setSending(true);
    const text = input.trim();
    setInput("");
    const { error } = await supabase.from("private_messages").insert({ sender_id: user.id, receiver_id: partnerId, content: text });
    if (error) { toast.error("تعذر الإرسال"); setInput(text); }
    setSending(false);
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 8 * 1024 * 1024) { toast.error("الحد الأقصى 8 ميجابايت"); return; }
    setUploading(true);
    try {
      const path = await uploadPrivateImage(user.id, partnerId, file);
      const { error } = await supabase.from("private_messages").insert({
        sender_id: user.id,
        receiver_id: partnerId,
        content: "📷 صورة",
        image_path: path,
      });
      if (error) throw error;
      toast.success("تم إرسال الصورة (تختفي بعد الفتح)");
    } catch {
      toast.error("تعذر رفع الصورة");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function openImage(m: PM) {
    if (!user || !m.image_path || m.viewed_at) return;
    const url = await getPrivateImageUrl(m.image_path);
    if (!url) { toast.error("تعذر تحميل الصورة"); return; }
    setViewingUrl(url);
    setViewingId(m.id);
    if (m.receiver_id === user.id) {
      // mark viewed and delete file so it disappears
      await supabase.from("private_messages").update({ viewed_at: new Date().toISOString(), content: "📷 صورة (تم فتحها)" }).eq("id", m.id);
      void deletePrivateImage(m.image_path);
      setMessages((prev) => prev.map((x) => x.id === m.id ? { ...x, viewed_at: new Date().toISOString(), content: "📷 صورة (تم فتحها)" } : x));
    }
  }

  function closeViewer() {
    setViewingUrl(null);
    setViewingId(null);
  }

  if (loading || !partner) return <div className="min-h-dvh flex items-center justify-center text-muted-foreground">جاري التحميل...</div>;

  return (
    <AppShell hideNav>
      <div className="flex flex-col h-dvh max-w-md mx-auto">
        <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border px-3 py-3 flex items-center gap-3">
          <Link to="/messages" className="p-2 -mr-2 text-muted-foreground"><ArrowRight className="size-5" /></Link>
          <Avatar profile={partner} size="md" />
          <Link to="/profile/$userId" params={{ userId: partner.id }} className="flex-1 min-w-0">
            <h1 className="font-bold text-sm truncate" style={{ color: partner.name_color }}>{partner.username}</h1>
            <p className="text-[10px] text-secondary">{partner.is_online ? "متصل الآن" : "غير متصل"}</p>
          </Link>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-8">ابدأ المحادثة الآن ✨</p>
          )}
          {messages.map((m) => {
            const self = m.sender_id === user?.id;
            const isImage = !!m.image_path && !m.viewed_at;
            const isViewedImage = m.content.includes("تم فتحها") || (m.image_path === null && m.viewed_at);
            return (
              <div key={m.id} className={`flex ${self ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm border ${self ? "bg-primary/20 border-primary/30 rounded-bl-none" : "bg-surface border-border rounded-br-none"}`}>
                  {isImage ? (
                    <button
                      type="button"
                      onClick={() => openImage(m)}
                      disabled={self}
                      className="flex items-center gap-2 py-4 px-2 disabled:opacity-70"
                    >
                      <Eye className="size-5 text-primary" />
                      <span className="text-xs font-bold">{self ? "بانتظار الفتح" : "اضغط للعرض (تختفي بعده)"}</span>
                    </button>
                  ) : m.viewed_at && m.content.includes("فتحها") ? (
                    <div className="flex items-center gap-2 py-2 opacity-60">
                      <EyeOff className="size-4" />
                      <span className="text-xs">صورة مؤقتة — تم فتحها</span>
                    </div>
                  ) : (
                    <span>{m.content}</span>
                  )}
                  <div className="text-[9px] text-muted-foreground mt-1">{new Date(m.created_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>
            );
          })}
        </div>

        <form onSubmit={send} className="p-3 bg-surface border-t border-border">
          <div className="flex items-center gap-2 bg-background border border-border rounded-full p-1 pr-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="size-10 rounded-full flex items-center justify-center text-primary hover:bg-primary/10 disabled:opacity-50"
              aria-label="إرسال صورة مؤقتة"
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-5" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="اكتب رسالة..." maxLength={500} className="flex-1 bg-transparent py-2 text-sm focus:outline-none" />
            <button type="submit" disabled={sending || !input.trim()} className="size-10 rounded-full gradient-brand flex items-center justify-center text-white disabled:opacity-50">
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 rotate-180" />}
            </button>
          </div>
        </form>
      </div>

      {viewingUrl && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4" onClick={closeViewer}>
          <img src={viewingUrl} alt="صورة مؤقتة" className="max-w-full max-h-[80vh] rounded-2xl" />
          <p className="text-white/70 text-xs mt-4">اضغط في أي مكان للإغلاق — ستختفي الصورة نهائياً</p>
          <p className="text-white/50 text-[10px] mt-1">#{viewingId?.slice(0, 6)}</p>
        </div>
      )}
    </AppShell>
  );
}
