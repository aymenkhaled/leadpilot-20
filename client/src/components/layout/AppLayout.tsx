import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth, useLogout } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import KeyboardShortcutsDialog from "@/components/KeyboardShortcutsDialog";
import { cn, initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard, Briefcase, Zap, Building2, Users, Mail, Bot, Settings,
  Shield, ChevronLeft, ChevronRight, LogOut, CreditCard, Menu, X, Target,
  TrendingUp, Keyboard,
} from "lucide-react";
import { Redirect } from "wouter";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { label: "Signals", href: "/app/signals", icon: Zap },
  { label: "Jobs", href: "/app/jobs", icon: Briefcase },
  { label: "Companies", href: "/app/companies", icon: Building2 },
  { label: "Contacts", href: "/app/contacts", icon: Users },
  { label: "Outreach", href: "/app/outreach", icon: Mail },
  { label: "Agent Runs", href: "/app/agent", icon: Bot },
  { label: "Settings", href: "/app/settings", icon: Settings },
  { label: "Admin", href: "/app/admin", icon: Shield, adminOnly: true },
];

const PLAN_COLORS: Record<string, string> = {
  free: "bg-zinc-500/20 text-zinc-400",
  pro: "bg-indigo-500/20 text-indigo-400",
  agency: "bg-violet-500/20 text-violet-400",
  scale: "bg-yellow-500/20 text-yellow-400",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const { user, workspace, isLoading, isAuthenticated } = useAuth();
  const logout = useLogout();

  const { data: pendingRunsData } = useQuery({
    queryKey: ["agent-runs-pending"],
    queryFn: () => api.get<any>("/agent/runs?status=pending&limit=1"),
    refetchInterval: 12000,
    enabled: isAuthenticated,
  });
  const { data: runningRunsData } = useQuery({
    queryKey: ["agent-runs-running"],
    queryFn: () => api.get<any>("/agent/runs?status=running&limit=1"),
    refetchInterval: 5000,
    enabled: isAuthenticated,
  });
  const { data: signalStatsData } = useQuery({
    queryKey: ["signals", "stats"],
    queryFn: () => api.get<any>("/signals/stats"),
    refetchInterval: 30000,
    enabled: isAuthenticated,
  });
  const pendingCount = (pendingRunsData?.pagination?.total || 0) + (runningRunsData?.pagination?.total || 0);
  const unactedSignals = signalStatsData?.unacted || 0;

  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect to="/login" />;

  const navItems = NAV_ITEMS.filter(item => !item.adminOnly || user?.isAdmin);
  const credits = parseFloat(String(workspace?.credits ?? 0));

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={cn(
      "flex flex-col h-full border-r border-border bg-card/50 transition-all duration-300",
      !mobile && (collapsed ? "w-16" : "w-56"),
      mobile && "w-64"
    )}>
      {/* Logo */}
      <div className={cn("flex items-center h-14 px-4 border-b border-border shrink-0", collapsed && !mobile && "justify-center px-2")}>
        {(!collapsed || mobile) ? (
          <Link href="/app/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <Target className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm text-foreground">LeadPilot</span>
            <span className="text-[10px] font-medium text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded-full">2.0</span>
          </Link>
        ) : (
          <Link href="/app/dashboard">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Target className="w-4 h-4 text-white" />
            </div>
          </Link>
        )}
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 py-2">
        <nav className="space-y-0.5 px-2">
          {navItems.map((item) => {
            const isActive = location === item.href || location.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  onClick={() => mobile && setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-all cursor-pointer group",
                    isActive
                      ? "bg-indigo-600/15 text-indigo-400"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    collapsed && !mobile && "justify-center px-2"
                  )}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <Icon className={cn("w-4 h-4 shrink-0", isActive && "text-indigo-400")} />
                  {(!collapsed || mobile) && (
                    <span className="font-medium">{item.label}</span>
                  )}
                  {item.badge && (!collapsed || mobile) && (
                    <Badge variant="indigo" className="ml-auto text-[10px] px-1.5 py-0">{item.badge}</Badge>
                  )}
                  {item.href === "/app/signals" && unactedSignals > 0 && (!collapsed || mobile) && (
                    <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-yellow-500 text-[10px] font-bold text-white px-1">
                      {unactedSignals > 99 ? "99+" : unactedSignals}
                    </span>
                  )}
                  {item.href === "/app/agent" && pendingCount > 0 && (!collapsed || mobile) && (
                    <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1">
                      {pendingCount}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Keyboard shortcut hint */}
      {(!collapsed || mobile) && (
        <div className="px-4 pb-1">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
            <Keyboard className="w-3 h-3" />
            <span>Press <kbd className="px-1 py-px bg-muted rounded text-[9px] font-mono border border-border">?</kbd> for shortcuts</span>
          </div>
        </div>
      )}

      {/* Credits */}
      {(!collapsed || mobile) && (
        <div className="p-3 border-t border-border">
          <div className={cn(
            "rounded-lg border p-3",
            credits < 10
              ? "bg-red-500/5 border-red-500/20"
              : "bg-indigo-500/5 border-indigo-500/10"
          )}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">Credits</span>
              <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded-full", PLAN_COLORS[workspace?.plan || "free"])}>
                {workspace?.plan?.toUpperCase()}
              </span>
            </div>
            <div className={cn("text-xl font-bold", credits < 10 ? "text-red-400" : "text-indigo-400")}>
              {credits.toLocaleString()}
            </div>
            {credits < 10 && (
              <p className="text-[10px] text-red-400 mt-0.5">Low credits — upgrade plan</p>
            )}
            <div className="w-full h-1.5 rounded-full bg-border mt-2">
              <div
                className={cn("h-full rounded-full transition-all", credits < 10 ? "bg-red-500" : "bg-indigo-500")}
                style={{ width: `${Math.min(100, (credits / getPlanMax(workspace?.plan)) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* User */}
      <div className={cn("p-3 border-t border-border", collapsed && !mobile && "px-2")}>
        {(!collapsed || mobile) ? (
          <div className="flex items-center gap-2.5">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="text-xs">{initials(`${user?.firstName} ${user?.lastName}`)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{user?.firstName} {user?.lastName}</div>
              <div className="text-[10px] text-muted-foreground truncate">{user?.email}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground"
              onClick={() => logout.mutate()}
              data-testid="logout-button"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 items-center">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs">{initials(`${user?.firstName} ${user?.lastName}`)}</AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => logout.mutate()}>
              <LogOut className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col relative">
        <Sidebar />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-16 z-10 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shadow-sm"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center h-14 px-4 border-b border-border bg-card/50 shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 mx-auto">
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
              <Target className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm">LeadPilot</span>
          </div>
          <div className="w-9" />
        </div>

        {/* Page content */}
        <ScrollArea className="flex-1">
          <main className="min-h-full">
            {children}
          </main>
        </ScrollArea>
        <KeyboardShortcutsDialog />
      </div>
    </div>
  );
}

function getPlanMax(plan?: string): number {
  const maxes: Record<string, number> = { free: 50, pro: 2000, agency: 10000, scale: 100000 };
  return maxes[plan || "free"] || 50;
}
