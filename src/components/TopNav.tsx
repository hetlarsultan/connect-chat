import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Users, Mail, User } from "lucide-react";
import { useNotifications } from "@/lib/use-notifications";

export function TopNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { unreadMessages, friendRequests } = useNotifications();

  const items = [
    { to: "/", icon: Home, label: "الغرف", badge: friendRequests },
    { to: "/members", icon: Users, label: "المتصلون", badge: friendRequests },
    { to: "/messages", icon: Mail, label: "الرسائل", badge: unreadMessages },
    { to: "/profile", icon: User, label: "حسابي", badge: 0 },
  ] as const;

  return (
    <nav className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border">
      <div className="max-w-md mx-auto grid grid-cols-4 gap-1 p-1.5">
        {items.map(({ to, icon: Icon, label, badge }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`relative flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all ${
                active ? "bg-primary/15" : ""
              }`}
            >
              <div className="relative">
                <Icon className={`size-[18px] ${active ? "text-primary" : "text-muted-foreground"}`} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border border-background">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-bold ${active ? "text-primary" : "text-muted-foreground"}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
