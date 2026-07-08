import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Users, Mail, User } from "lucide-react";

const items = [
  { to: "/", icon: Home, label: "الغرف" },
  { to: "/members", icon: Users, label: "المتصلون" },
  { to: "/messages", icon: Mail, label: "الرسائل" },
  { to: "/profile", icon: User, label: "حسابي" },
] as const;

export function TopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border">
      <div className="max-w-md mx-auto grid grid-cols-4 gap-1 p-2">
        {items.map(({ to, icon: Icon, label }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-all ${
                active ? "bg-primary/15" : ""
              }`}
            >
              <Icon className={`size-6 ${active ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-[11px] font-bold ${active ? "text-primary" : "text-muted-foreground"}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
