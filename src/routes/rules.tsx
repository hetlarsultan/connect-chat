import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Shield, AlertTriangle, Lock } from "lucide-react";

export const Route = createFileRoute("/rules")({
  head: () => ({ meta: [{ title: "القوانين والخصوصية - شات عالمي" }] }),
  component: RulesPage,
});

function RulesPage() {
  return (
    <AppShell>
      <PageHeader title="القوانين والخصوصية" />
      <div className="p-4 space-y-4">
        <Section icon={Shield} color="#10b981" title="قوانين الدردشة (UGC)">
          <Rule num="1">احترم جميع الأعضاء وتجنب الكلام البذيء.</Rule>
          <Rule num="2">ممنوع نشر محتوى مسيء أو غير لائق.</Rule>
          <Rule num="3">ممنوع الإعلانات والترويج لخدمات خارجية.</Rule>
          <Rule num="4">ممنوع انتحال شخصية الإدارة أو المشاهير.</Rule>
          <Rule num="5">احترم الأعمار - لا تشارك معلومات شخصية.</Rule>
        </Section>

        <Section icon={AlertTriangle} color="#f59e0b" title="عقوبات المخالفات">
          <p className="text-sm text-muted-foreground leading-relaxed">المخالفة الأولى: تنبيه. المخالفة الثانية: طرد مؤقت. المخالفة الثالثة: حظر دائم.</p>
        </Section>

        <Section icon={Lock} color="#06b6d4" title="سياسة الخصوصية">
          <p className="text-sm text-muted-foreground leading-relaxed">نحن نحترم خصوصيتك. لا نشارك بياناتك مع أطراف خارجية. الرسائل الخاصة مشفرة ومحمية. يمكنك حذف حسابك في أي وقت.</p>
        </Section>
      </div>
    </AppShell>
  );
}

function Section({ icon: Icon, color, title, children }: any) {
  return (
    <div className="p-4 rounded-2xl bg-surface border border-border">
      <div className="flex items-center gap-3 mb-3">
        <div className="size-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}33` }}>
          <Icon className="size-5" style={{ color }} />
        </div>
        <h3 className="font-bold">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Rule({ num, children }: { num: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="font-bold text-primary shrink-0">{num}.</span>
      <span className="text-muted-foreground">{children}</span>
    </div>
  );
}
