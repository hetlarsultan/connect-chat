import { Link, useRouterState } from "@tanstack/react-router";
import { Home, MessageCircle, Users, Mail, Settings, Newspaper, Scale, User } from "lucide-react";

const items = [
  { to: "/", icon: Home, label: "الغرف" },
  { to: "/members", icon: Users, label: "المتصلون" },
  { to: "/messages", icon: Mail, label: "الرسائل" },
  { to: "/profile", icon: User, label: "حسابي" },
  { to: "/news", icon: Newspaper, label: "أخبار" },
  { to: "/rules", icon: Scale, label: "القوانين" },
  { to: "/audio", icon: Settings, label: "الصوت" },
  { to: "/chat", icon: MessageCircle, label: "الدردشة" },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-xl border-t border-border">
      <div className="max-w-md mx-auto grid grid-cols-4 gap-1 p-2">
        {items.map(({ to, icon: Icon, label }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to === "/chat" ? "/" : to}
              className="flex flex-col items-center gap-1 py-2 rounded-xl transition-colors"
            >
              <Icon className={`size-5 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-[10px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
