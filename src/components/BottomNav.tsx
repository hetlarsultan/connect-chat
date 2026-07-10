import { Link, useRouterState } from "@tanstack/react-router";
import { Settings, Newspaper, Scale } from "lucide-react";

const items = [
  { to: "/news", icon: Newspaper, label: "أخبار" },
  { to: "/rules", icon: Scale, label: "القوانين" },
  { to: "/audio", icon: Settings, label: "الصوت" },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-xl border-t border-border">
      <div className="max-w-md mx-auto grid grid-cols-3 gap-1 p-2">
        {items.map(({ to, icon: Icon, label }) => {
          const active = pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-colors"
            >
              <Icon className={`size-[16px] ${active ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-[9px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
