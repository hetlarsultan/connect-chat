import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { LogOut, Save, Loader2, Camera } from "lucide-react";
import { toast } from "sonner";
import { uploadAvatar } from "@/lib/storage";

export const Route = createFileRoute("/profile/")({
  head: () => ({ meta: [{ title: "ملفي الشخصي - شات عالمي" }] }),
  component: ProfilePage,
});

const COLORS = ["#8b5cf6", "#06b6d4", "#ec4899", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#3b82f6"];

function ProfilePage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"info" | "colors">("info");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [age, setAge] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [nameColor, setNameColor] = useState("#8b5cf6");
  const [textColor, setTextColor] = useState("#e2e8f0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
      setBio(profile.bio || "");
      setAge(profile.age?.toString() ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
      setNameColor(profile.name_color);
      setTextColor(profile.text_color);
    }
  }, [profile]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      username: username.trim(),
      bio: bio.trim(),
      age: age ? parseInt(age) : null,
      avatar_url: avatarUrl.trim() || null,
      name_color: nameColor,
      text_color: textColor,
    }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error("تعذر الحفظ");
    else {
      toast.success("تم حفظ الملف الشخصي");
      await refreshProfile();
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  if (loading || !profile) return <div className="min-h-dvh flex items-center justify-center text-muted-foreground">جاري التحميل...</div>;

  return (
    <AppShell>
      <PageHeader title="ملفي الشخصي" right={
        <button onClick={logout} className="text-destructive p-2"><LogOut className="size-5" /></button>
      } />

      <div className="p-6 flex flex-col items-center gap-3 bg-gradient-to-b from-primary/10 to-transparent">
        <Avatar profile={{ ...profile, name_color: nameColor, avatar_url: avatarUrl || profile.avatar_url }} size="xl" />
        <h2 className="text-xl font-bold" style={{ color: nameColor }}>{username}</h2>
        <p className="text-xs text-muted-foreground">{profile.gender === "female" ? "أنثى" : "ذكر"} {age && `• ${age} سنة`} {profile.is_guest && "• زائر"}</p>
        <p className="text-[10px] text-muted-foreground font-mono">ID: {profile.id.slice(0, 8)}</p>
      </div>

      <div className="flex border-b border-border mx-4">
        {(["info", "colors"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 text-sm font-bold ${tab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>
            {t === "info" ? "البيانات" : "الألوان"}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {tab === "info" && (
          <>
            <Field label="اسم المستخدم"><input value={username} onChange={(e) => setUsername(e.target.value)} className="input" /></Field>
            <Field label="العمر"><input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="input" /></Field>
            <Field label="رابط الصورة الشخصية"><input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." className="input" /></Field>
            <Field label="النبذة"><textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={150} rows={3} className="input resize-none" /></Field>
          </>
        )}

        {tab === "colors" && (
          <>
            <Field label="لون اسمك في الدردشة">
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setNameColor(c)} className={`size-9 rounded-full border-2 transition-all ${nameColor === c ? "border-foreground scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="mt-2 p-3 rounded-xl bg-surface border border-border text-center text-sm font-bold" style={{ color: nameColor }}>
                {username}: معاينة الاسم
              </div>
            </Field>

            <Field label="لون نص رسائلك">
              <div className="flex flex-wrap gap-2">
                {["#e2e8f0", "#fbbf24", "#34d399", "#60a5fa", "#f472b6", "#a78bfa", "#fb7185", "#ffffff"].map((c) => (
                  <button key={c} onClick={() => setTextColor(c)} className={`size-9 rounded-full border-2 transition-all ${textColor === c ? "border-primary scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="mt-2 p-3 rounded-xl bg-surface border border-border text-sm" style={{ color: textColor }}>
                معاينة نص الرسالة بهذا اللون
              </div>
            </Field>
          </>
        )}

        <button onClick={save} disabled={saving} className="w-full gradient-brand text-white py-3.5 rounded-xl font-bold glow-primary flex items-center justify-center gap-2 mt-4">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          حفظ التغييرات
        </button>
      </div>

      <style>{`.input { width:100%; background:var(--background); border:1px solid var(--border); border-radius:0.75rem; padding:0.625rem 0.875rem; font-size:0.875rem; outline:none; } .input:focus { border-color:var(--primary); }`}</style>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold text-muted-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
