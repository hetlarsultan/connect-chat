import { useState } from "react";
import { ShieldCheck, KeyRound, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { toast } from "sonner";

export function GuestUpgradeBadge() {
  const { user, profile, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"info" | "password">("info");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  if (!user || !profile || !profile.is_guest) return null;

  async function upgrade() {
    if (password.length < 6) { toast.error("كلمة المرور 6 أحرف على الأقل"); return; }
    if (password !== confirm) { toast.error("كلمتا المرور غير متطابقتين"); return; }
    if (!email.includes("@")) { toast.error("بريد إلكتروني غير صالح"); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ email, password });
    if (error) {
      setSaving(false);
      toast.error(error.message || "تعذر التحويل");
      return;
    }
    if (user) {
      await supabase.from("profiles").update({ is_guest: false }).eq("id", user.id);
    }
    await refreshProfile();
    setSaving(false);
    setOpen(false);
    toast.success("تم توثيق الحساب بنجاح 🎉 تحقق من بريدك للتفعيل");
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-surface border-border max-w-sm">
          <button onClick={() => setOpen(false)} className="absolute left-3 top-3 text-muted-foreground"><X className="size-4" /></button>
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
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="البريد الإلكتروني"
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
                dir="ltr"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="كلمة المرور (6 أحرف على الأقل)"
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
                dir="ltr"
              />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="تأكيد كلمة المرور"
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
                dir="ltr"
              />
              <button
                onClick={upgrade}
                disabled={saving}
                className="w-full gradient-brand text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                تفعيل العضوية
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
