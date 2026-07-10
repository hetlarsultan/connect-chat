import { Link, useRouterState } from "@tanstack/react-router";
import { Settings, Newspaper, Scale, Bell } from "lucide-react";
import { useNotifications } from "@/lib/use-notifications";

const items = [
  { to: "/notifications", icon: Bell, label: "الإشعارات", withBadge: true },
  { to: "/news", icon: Newspaper, label: "أخبار", withBadge: false },
  { to: "/rules", icon: Scale, label: "القوانين", withBadge: false },
  { to: "/audio", icon: Settings, label: "الصوت", withBadge: false },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { unreadMessages, friendRequests } = useNotifications();
  const totalBadge = unreadMessages + friendRequests;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-xl border-t border-border">
      <div className="max-w-md mx-auto grid grid-cols-4 gap-1 p-2">
        {items.map(({ to, icon: Icon, label, withBadge }) => {
          const active = pathname.startsWith(to);
          const badge = withBadge ? totalBadge : 0;
          return (
            <Link
              key={to}
              to={to}
              className="relative flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-colors"
            >
              <div className="relative">
                <Icon className={`size-[16px] ${active ? "text-primary" : "text-muted-foreground"}`} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border border-background">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </div>
              <span className={`text-[9px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
