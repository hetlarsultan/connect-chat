import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { TopNav } from "./TopNav";
import { GuestUpgradeBadge } from "./GuestUpgradeBadge";

export function AppShell({ children, hideNav = false }: { children: ReactNode; hideNav?: boolean }) {
  return (
    <div className="min-h-dvh max-w-md mx-auto bg-background/40 border-x border-border/40 relative">
      {!hideNav && <TopNav />}
      <div className={hideNav ? "" : "pb-24"}>{children}</div>
      {!hideNav && <BottomNav />}
      {!hideNav && <GuestUpgradeBadge />}
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-lg font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-xs text-secondary mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}
