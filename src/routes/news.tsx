import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Bell, Sparkles, Trophy } from "lucide-react";

export const Route = createFileRoute("/news")({
  head: () => ({ meta: [{ title: "أخبار الشات - شات عالمي" }] }),
  component: NewsPage,
});

const news = [
  { icon: Sparkles, color: "#8b5cf6", title: "إصدار جديد!", body: "أطلقنا نسخة 2.0 من شات عالمي بتصميم محدث وميزات جديدة." },
  { icon: Trophy, color: "#f59e0b", title: "مسابقة الأسبوع", body: "شارك في غرفة الموسيقى للفوز بألقاب مميزة." },
  { icon: Bell, color: "#06b6d4", title: "غرف جديدة", body: "أضفنا غرف الرياضة والتعارف، انضم الآن!" },
];

function NewsPage() {
  return (
    <AppShell>
      <PageHeader title="أخبار الشات" subtitle="آخر التحديثات والإعلانات" />
      <div className="p-4 space-y-3">
        {news.map((n, i) => (
          <div key={i} className="p-4 rounded-2xl bg-surface border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${n.color}33` }}>
                <n.icon className="size-5" style={{ color: n.color }} />
              </div>
              <h3 className="font-bold">{n.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{n.body}</p>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
