import { useEffect, useState } from "react";
import { Lock, KeyRound, ShieldCheck, Trash2, X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import {
  isLockEnabled,
  isUnlocked,
  markUnlocked,
  setLockPassword,
  verifyLockPassword,
  clearLock,
  lockNow,
} from "@/lib/private-lock";

export function PrivateLockGate({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const enabled = isLockEnabled(userId);

  useEffect(() => {
    setUnlocked(isUnlocked(userId));
    setChecked(true);
  }, [userId]);

  if (!checked) return null;
  if (!enabled || unlocked) return <>{children}</>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pwd) return;
    setBusy(true);
    const ok = await verifyLockPassword(userId, pwd);
    setBusy(false);
    if (!ok) { toast.error("كلمة المرور غير صحيحة"); return; }
    markUnlocked(userId);
    setUnlocked(true);
    setPwd("");
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <div className="size-20 rounded-full gradient-brand flex items-center justify-center mb-5 shadow-lg shadow-primary/30">
        <Lock className="size-9 text-white" />
      </div>
      <h1 className="text-lg font-bold mb-1">الرسائل الخاصة مقفلة 🔒</h1>
      <p className="text-xs text-muted-foreground mb-6">أدخل كلمة المرور السرية لعرض محادثاتك</p>
      <form onSubmit={submit} className="w-full max-w-xs space-y-3">
        <div className="flex items-center gap-2 bg-surface border border-border rounded-full px-4">
          <KeyRound className="size-4 text-muted-foreground shrink-0" />
          <input
            type={show ? "text" : "password"}
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="كلمة المرور السرية"
            className="flex-1 bg-transparent py-3 text-sm focus:outline-none"
            autoFocus
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="text-muted-foreground p-1" aria-label="إظهار">
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <button
          type="submit"
          disabled={!pwd || busy}
          className="w-full py-3 rounded-full gradient-brand text-white text-sm font-bold disabled:opacity-50"
        >
          {busy ? "جاري التحقق..." : "فتح الرسائل"}
        </button>
      </form>
    </div>
  );
}

export function LockSettingsDialog({ userId, open, onOpenChange }: { userId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [mode, setMode] = useState<"set" | "change" | "remove">("set");
  const [current, setCurrent] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(isLockEnabled(userId) ? "change" : "set");
      setCurrent(""); setPwd(""); setConfirm("");
    }
  }, [open, userId]);

  if (!open) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode !== "set") {
        const ok = await verifyLockPassword(userId, current);
        if (!ok) { toast.error("كلمة المرور الحالية غير صحيحة"); return; }
      }
      if (mode === "remove") {
        clearLock(userId);
        toast.success("تم إلغاء القفل");
        onOpenChange(false);
        return;
      }
      if (pwd.length < 4) { toast.error("4 أحرف على الأقل"); return; }
      if (pwd !== confirm) { toast.error("كلمتا المرور غير متطابقتين"); return; }
      await setLockPassword(userId, pwd);
      toast.success(mode === "set" ? "تم تفعيل القفل ✅" : "تم تحديث كلمة المرور");
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  function doLockNow() {
    lockNow(userId);
    toast.success("تم قفل الرسائل");
    onOpenChange(false);
    // force gate to show
    setTimeout(() => window.location.reload(), 300);
  }

  const enabled = isLockEnabled(userId);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => onOpenChange(false)}>
      <div className="w-full max-w-sm bg-surface border border-border rounded-3xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <h3 className="font-bold text-sm">قفل الرسائل الخاصة</h3>
          </div>
          <button onClick={() => onOpenChange(false)} className="text-muted-foreground p-1"><X className="size-4" /></button>
        </div>

        {enabled && (
          <div className="flex gap-1.5 mb-4 bg-background rounded-full p-1">
            <button type="button" onClick={() => setMode("change")} className={`flex-1 py-1.5 text-[11px] rounded-full font-bold ${mode === "change" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>تغيير</button>
            <button type="button" onClick={() => setMode("remove")} className={`flex-1 py-1.5 text-[11px] rounded-full font-bold ${mode === "remove" ? "bg-red-500 text-white" : "text-muted-foreground"}`}>إلغاء القفل</button>
          </div>
        )}

        <form onSubmit={save} className="space-y-3">
          {mode !== "set" && (
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="كلمة المرور الحالية"
              className="w-full bg-background border border-border rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
            />
          )}
          {mode !== "remove" && (
            <>
              <input
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                placeholder="كلمة المرور السرية (4 أحرف على الأقل)"
                className="w-full bg-background border border-border rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
              />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="تأكيد كلمة المرور"
                className="w-full bg-background border border-border rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
              />
            </>
          )}
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            🔐 يتم حفظ كلمة المرور مشفّرة على هذا الجهاز فقط. لا يمكن استعادتها إذا نسيتها — يجب إلغاء القفل من الجهاز نفسه.
          </p>
          <button type="submit" disabled={busy} className="w-full py-2.5 rounded-full gradient-brand text-white text-sm font-bold disabled:opacity-50">
            {mode === "set" ? "تفعيل القفل" : mode === "change" ? "حفظ" : "إلغاء القفل"}
          </button>
        </form>

        {enabled && mode !== "remove" && (
          <button
            type="button"
            onClick={doLockNow}
            className="w-full mt-3 py-2.5 rounded-full bg-background border border-border text-xs font-bold flex items-center justify-center gap-2"
          >
            <Lock className="size-3.5" /> قفل الرسائل الآن
          </button>
        )}
      </div>
    </div>
  );
}
