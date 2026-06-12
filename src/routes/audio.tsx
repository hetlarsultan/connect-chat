import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Volume2, Bell, MessageSquare, LogIn } from "lucide-react";

export const Route = createFileRoute("/audio")({
  head: () => ({ meta: [{ title: "إعدادات الصوت - شات عالمي" }] }),
  component: AudioPage,
});

type Settings = {
  master: number;
  msgSound: boolean;
  pmSound: boolean;
  joinSound: boolean;
  notifications: boolean;
};

const KEY = "shat-audio-settings";

function AudioPage() {
  const [s, setS] = useState<Settings>({ master: 80, msgSound: true, pmSound: true, joinSound: false, notifications: true });

  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    if (raw) try { setS(JSON.parse(raw)); } catch {}
  }, []);

  function update(patch: Partial<Settings>) {
    const next = { ...s, ...patch };
    setS(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  }

  return (
    <AppShell>
      <PageHeader title="إعدادات الصوت" subtitle="تحكم كامل بالأصوات والتنبيهات" />

      <div className="p-4 space-y-4">
        <div className="p-5 rounded-2xl bg-surface border border-border">
          <div className="flex items-center gap-3 mb-4">
            <Volume2 className="size-5 text-primary" />
            <h3 className="font-bold">مستوى الصوت الرئيسي</h3>
          </div>
          <div className="flex items-center gap-3">
            <input type="range" min="0" max="100" value={s.master} onChange={(e) => update({ master: parseInt(e.target.value) })} className="flex-1 accent-primary" />
            <span className="text-sm font-bold w-10 text-center">{s.master}%</span>
          </div>
        </div>

        <Toggle icon={MessageSquare} label="صوت رسائل الغرف" value={s.msgSound} onChange={(v: boolean) => update({ msgSound: v })} />
        <Toggle icon={Bell} label="صوت الرسائل الخاصة" value={s.pmSound} onChange={(v: boolean) => update({ pmSound: v })} />
        <Toggle icon={LogIn} label="صوت دخول الأعضاء" value={s.joinSound} onChange={(v: boolean) => update({ joinSound: v })} />
        <Toggle icon={Bell} label="التنبيهات المنبثقة" value={s.notifications} onChange={(v: boolean) => update({ notifications: v })} />
      </div>
    </AppShell>
  );
}

function Toggle({ icon: Icon, label, value, onChange }: any) {
  return (
    <div className="p-4 rounded-2xl bg-surface border border-border flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Icon className="size-5 text-secondary" />
        <span className="text-sm font-bold">{label}</span>
      </div>
      <button onClick={() => onChange(!value)} className={`w-12 h-6 rounded-full transition-colors relative ${value ? "bg-primary" : "bg-border"}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${value ? "left-0.5" : "right-0.5"}`} />
      </button>
    </div>
  );
}
