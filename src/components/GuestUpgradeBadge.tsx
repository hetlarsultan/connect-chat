import { useMemo, useState } from "react";
import { ShieldCheck, KeyRound, Loader2, X, AlertCircle, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { toast } from "sonner";

type FieldErrors = { email?: string; password?: string; confirm?: string; form?: string };

function scorePassword(pw: string) {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4); // 0..4
}

const STRENGTH = [
  { label: "ضعيفة جدًا", color: "bg-red-500", text: "text-red-500" },
  { label: "ضعيفة", color: "bg-orange-500", text: "text-orange-500" },
  { label: "متوسطة", color: "bg-yellow-500", text: "text-yellow-500" },
  { label: "قوية", color: "bg-lime-500", text: "text-lime-500" },
  { label: "قوية جدًا", color: "bg-green-500", text: "text-green-500" },
];

export function GuestUpgradeBadge() {
  const { user, profile, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"info" | "password">("info");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const strength = useMemo(() => scorePassword(password), [password]);
  const strengthInfo = STRENGTH[strength];

  if (!user || !profile || !profile.is_guest) return null;

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      e.email = "بريد إلكتروني غير صالح";
    }
    if (!password) e.password = "كلمة المرور مطلوبة";
    else if (password.length < 6) e.password = "كلمة المرور 6 أحرف على الأقل";
    else if (strength < 2) e.password = "كلمة المرور ضعيفة جدًا، أضف أرقامًا أو رموزًا";
    if (!confirm) e.confirm = "يرجى تأكيد كلمة المرور";
    else if (password !== confirm) e.confirm = "كلمتا المرور غير متطابقتين";
    return e;
  }

  async function upgrade() {
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) return;
    setSaving(true);
    try {
      const payload: { password: string; email?: string } = { password };
      if (email.trim()) payload.email = email.trim();
      const { error } = await supabase.auth.updateUser(payload);
      if (error) {
        setErrors({ form: error.message || "تعذر تحديث الحساب" });
        setSaving(false);
        return;
      }
      if (user) {
        const { error: pErr } = await supabase.from("profiles").update({ is_guest: false }).eq("id", user.id);
        if (pErr) {
          setErrors({ form: pErr.message || "تعذر تحديث الملف الشخصي" });
          setSaving(false);
          return;
        }
      }
      await refreshProfile();
      setSaving(false);
      setOpen(false);
      toast.success(email.trim() ? "تم التوثيق 🎉 تحقق من بريدك للتفعيل" : "تم توثيق حسابك 🎉");
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "حدث خطأ غير متوقع" });
      setSaving(false);
    }
  }

  function resetAndClose(v: boolean) {
    setOpen(v);
    if (!v) {
      setStep("info");
      setEmail("");
      setPassword("");
      setConfirm("");
      setErrors({});
      setShowPw(false);
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { setStep("info"); setOpen(true); }}
        className="fixed bottom-24 left-3 z-50 flex items-center gap-1.5 px-3 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg animate-pulse hover:animate-none"
        aria-label="توثيق الحساب"
      >
        <ShieldCheck className="size-4" />
        <span className="text-[11px] font-bold">وثّق حسابك</span>
      </button>

      <Dialog open={open} onOpenChange={resetAndClose}>
        <DialogContent className="bg-surface border-border max-w-sm">
          <button onClick={() => resetAndClose(false)} className="absolute left-3 top-3 text-muted-foreground" aria-label="إغلاق"><X className="size-4" /></button>
          {step === "info" ? (
            <div className="text-center space-y-3 py-2">
              <div className="mx-auto size-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <ShieldCheck className="size-7 text-white" />
              </div>
              <DialogTitle className="text-lg">حوّل حسابك إلى عضو دائم</DialogTitle>
              <p className="text-xs text-muted-foreground leading-relaxed">
                كزائر، يُحذف حسابك بعد يومين من عدم النشاط. بتوثيق حسابك بكلمة مرور تصبح عضوًا دائمًا وتحتفظ بمحادثاتك وأصدقائك.
              </p>
              <button
                onClick={() => setStep("password")}
                className="w-full gradient-brand text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <KeyRound className="size-4" /> إضافة كلمة المرور
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <DialogTitle className="text-base">توثيق الحساب</DialogTitle>

              {errors.form && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl px-3 py-2 text-xs">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{errors.form}</span>
                </div>
              )}

              {/* Email (optional) */}
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>البريد الإلكتروني <span className="opacity-60">(اختياري)</span></span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors({ ...errors, email: undefined }); }}
                  placeholder="example@mail.com"
                  disabled={saving}
                  aria-invalid={!!errors.email}
                  className={`w-full bg-background border rounded-xl px-3 py-2.5 text-sm outline-none transition disabled:opacity-60 ${errors.email ? "border-red-500 focus:border-red-500" : "border-border focus:border-primary"}`}
                  dir="ltr"
                />
                {errors.email && <p className="text-[11px] text-red-500 flex items-center gap-1"><AlertCircle className="size-3" />{errors.email}</p>}
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">كلمة المرور</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors({ ...errors, password: undefined }); }}
                    placeholder="6 أحرف على الأقل"
                    disabled={saving}
                    aria-invalid={!!errors.password}
                    className={`w-full bg-background border rounded-xl px-3 py-2.5 pl-9 text-sm outline-none transition disabled:opacity-60 ${errors.password ? "border-red-500 focus:border-red-500" : "border-border focus:border-primary"}`}
                    dir="ltr"
                  />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="إظهار/إخفاء">
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {password && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[0,1,2,3].map((i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full ${i < strength ? strengthInfo.color : "bg-border"}`} />
                      ))}
                    </div>
                    <p className={`text-[11px] ${strengthInfo.text}`}>قوة كلمة المرور: {strengthInfo.label}</p>
                  </div>
                )}
                {errors.password && <p className="text-[11px] text-red-500 flex items-center gap-1"><AlertCircle className="size-3" />{errors.password}</p>}
              </div>

              {/* Confirm */}
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">تأكيد كلمة المرور</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); if (errors.confirm) setErrors({ ...errors, confirm: undefined }); }}
                    placeholder="أعد كتابة كلمة المرور"
                    disabled={saving}
                    aria-invalid={!!errors.confirm}
                    className={`w-full bg-background border rounded-xl px-3 py-2.5 pl-9 text-sm outline-none transition disabled:opacity-60 ${errors.confirm ? "border-red-500 focus:border-red-500" : "border-border focus:border-primary"}`}
                    dir="ltr"
                  />
                  {confirm && !errors.confirm && password === confirm && (
                    <CheckCircle2 className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-green-500" />
                  )}
                </div>
                {errors.confirm && <p className="text-[11px] text-red-500 flex items-center gap-1"><AlertCircle className="size-3" />{errors.confirm}</p>}
              </div>

              <button
                onClick={upgrade}
                disabled={saving || !password || !confirm}
                className="w-full gradient-brand text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <><Loader2 className="size-4 animate-spin" /> جارٍ التفعيل...</>
                ) : (
                  <><ShieldCheck className="size-4" /> تفعيل العضوية</>
                )}
              </button>
              <p className="text-[10px] text-muted-foreground text-center">
                بدون بريد إلكتروني، لن تتمكن من استعادة كلمة المرور لاحقًا.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
