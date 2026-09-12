"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Gem,
  Activity,
  GitCompareArrows,
  Map,
  Sigma,
  Database,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store";
import { NAV_ITEMS } from "@/lib/constants";
import { StatusIndicator } from "@/components/shared/StatusIndicator";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Gem,
  Activity,
  GitCompareArrows,
  Map,
  Sigma,
  Database,
  Settings,
};

function NavLinks({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV_ITEMS.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId="active-nav-pill"
                className="absolute inset-0 rounded-lg bg-primary/10"
                transition={{ type: "spring", duration: 0.4 }}
              />
            )}
            <Icon className={cn("h-4 w-4 shrink-0 relative", active && "text-primary")} />
            {!collapsed && <span className="relative truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex h-screen sticky top-0 flex-col border-r border-border glass transition-all duration-300 z-30",
          collapsed ? "w-[76px]" : "w-64"
        )}
      >
        <div className="flex items-center gap-2 px-4 py-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary shadow-sm">
            <Sparkles className="h-4.5 w-4.5 text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">NV-Nav</p>
              <p className="truncate text-[11px] text-muted-foreground">Magnetometry Dashboard</p>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
          <NavLinks collapsed={collapsed} />
        </div>

        <div className="border-t border-border p-3 space-y-3">
          {!collapsed && <StatusIndicator />}
          <button
            onClick={toggleSidebar}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs text-muted-foreground hover:bg-accent transition-colors"
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between glass-strong border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold">NV-Nav</span>
        </div>
        <div className="flex items-center gap-3">
          <StatusIndicator compact />
          <button onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 260 }}
              className="fixed left-0 top-0 z-50 h-full w-72 glass-strong border-r border-border md:hidden"
            >
              <div className="flex items-center justify-between px-4 py-5">
                <span className="text-sm font-semibold">Navigation</span>
                <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavLinks collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
