import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
});

type Mode = "quick" | "login" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("quick");
  const [loading, setLoading] = useState(false);

  const [username, setUsername] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function ensureProfile(userId: string, isGuest: boolean) {
    const finalUsername = username.trim() || `زائر_${userId.slice(0, 6)}`;
    await supabase.from("profiles").upsert({
      id: userId,
      username: finalUsername,
      age: age ? parseInt(age) : null,
      gender,
      is_guest: isGuest,
      is_online: true,
      name_color: gender === "female" ? "#ec4899" : "#8b5cf6",
    }, { onConflict: "id" });
  }

  async function handleQuick(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return toast.error("أدخل اسم المستخدم");
    if (!age || parseInt(age) < 13) return toast.error("أدخل عمراً صحيحاً (13+)");
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      if (data.user) {
        await ensureProfile(data.user.id, true);
        toast.success(`مرحباً ${username}!`);
        navigate({ to: "/" });
      }
    } catch (err: any) {
      toast.error(err.message || "فشل الدخول");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !age || !email || password.length < 6) {
      return toast.error("املأ جميع الحقول (كلمة المرور 6 أحرف على الأقل)");
    }
    setLoading(true);
    try {
      // Check username uniqueness
      const { data: existing } = await supabase.from("profiles").select("id").eq("username", username.trim()).maybeSingle();
      if (existing) {
        toast.error("اسم المستخدم محجوز");
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      if (data.user) {
        await ensureProfile(data.user.id, false);
        toast.success("تم إنشاء الحساب بنجاح!");
        navigate({ to: "/" });
      }
    } catch (err: any) {
      toast.error(err.message || "فشل إنشاء الحساب");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("مرحباً بعودتك!");
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error("بيانات الدخول غير صحيحة");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex p-4 rounded-3xl gradient-brand glow-primary">
            <MessageCircle className="size-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold gradient-brand bg-clip-text text-transparent">شات عالمي</h1>
          <p className="text-muted-foreground">تواصل مع العالم بلمسة واحدة</p>
        </div>

        <div className="bg-surface border border-border rounded-3xl shadow-xl overflow-hidden">
          <div className="grid grid-cols-3 border-b border-border">
            {(["quick","login","signup"] as Mode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`py-3 text-sm font-bold transition-colors ${mode === m ? "bg-primary/10 text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>
                {m === "quick" ? "دخول سريع" : m === "login" ? "دخول" : "اشتراك"}
              </button>
            ))}
          </div>

          <div className="p-6">
            {mode === "quick" && (
              <form onSubmit={handleQuick} className="space-y-3">
                <Input placeholder="اسم المستخدم" value={username} onChange={setUsername} />
                <div className="flex gap-3">
                  <Input type="number" placeholder="العمر" value={age} onChange={setAge} className="w-1/3" />
                  <Select value={gender} onChange={(v) => setGender(v as any)} className="w-2/3" />
                </div>
                <Submit loading={loading}>دخول كزائر</Submit>
              </form>
            )}

            {mode === "login" && (
              <form onSubmit={handleLogin} className="space-y-3">
                <Input type="email" placeholder="البريد الإلكتروني" value={email} onChange={setEmail} />
                <Input type="password" placeholder="كلمة المرور" value={password} onChange={setPassword} />
                <Submit loading={loading}>دخول بالعضوية</Submit>
              </form>
            )}

            {mode === "signup" && (
              <form onSubmit={handleSignup} className="space-y-3">
                <Input placeholder="اسم المستخدم" value={username} onChange={setUsername} />
                <div className="flex gap-3">
                  <Input type="number" placeholder="العمر" value={age} onChange={setAge} className="w-1/3" />
                  <Select value={gender} onChange={(v) => setGender(v as any)} className="w-2/3" />
                </div>
                <Input type="email" placeholder="البريد الإلكتروني" value={email} onChange={setEmail} />
                <Input type="password" placeholder="كلمة المرور (6+ أحرف)" value={password} onChange={setPassword} />
                <Submit loading={loading}>إنشاء حساب جديد</Submit>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">بالدخول أنت توافق على قوانين الدردشة وسياسة الخصوصية</p>
      </div>
    </div>
  );
}

function Input({ value, onChange, className = "", ...rest }: any) {
  return <input {...rest} value={value} onChange={(e) => onChange(e.target.value)} className={`w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors ${className}`} />;
}

function Select({ value, onChange, className = "" }: any) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary ${className}`}>
      <option value="male">ذكر</option>
      <option value="female">أنثى</option>
    </select>
  );
}

function Submit({ children, loading }: { children: React.ReactNode; loading: boolean }) {
  return (
    <button type="submit" disabled={loading} className="w-full gradient-brand text-white py-3.5 rounded-xl font-bold glow-primary disabled:opacity-50 flex items-center justify-center gap-2">
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}
