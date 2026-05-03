import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime, getSignalIcon, getSignalColor, getPlatformColor, getStatusColor, cn } from "@/lib/utils";
import { Link } from "wouter";
import {
  Briefcase, Users, Building2, Mail, Zap, Bot, TrendingUp, ArrowRight,
  CreditCard, Target, Activity, BarChart3, RefreshCw, Sparkles,
  CheckCircle2, Circle, ChevronDown, ChevronUp, X,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface DashboardData {
  jobs: { total: number };
  contacts: { total: number; verified: number };
  companies: { total: number };
  outreach: { total: number; sent: number; opened: number; replied: number; openRate: number; replyRate: number };
  signals: { total: number; strong: number };
  agent: { total: number; completed: number };
  pipeline: { won: number; active: number; budgetSum: number };
  funnel: Record<string, number>;
  credits: { balance: number; usedThisMonth: number; plan: string };
  recent: { jobs: any[]; signals: any[]; outreach: any[] };
}

function OnboardingChecklist({ dash }: { dash?: DashboardData }) {
  const [open, setOpen] = useState(true);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem("onboarding_dismissed") === "1"; } catch { return false; }
  });

  const steps = [
    {
      key: "jobs",
      label: "Scrape your first job postings",
      done: (dash?.jobs?.total ?? 0) > 0,
      href: "/app/jobs",
      desc: "Use the Jobs page to pull from 10+ job boards",
    },
    {
      key: "contacts",
      label: "Find decision-maker contact",
      done: (dash?.contacts?.total ?? 0) > 0,
      href: "/app/jobs",
      desc: "Click Enrich on any job to find the hiring manager",
    },
    {
      key: "outreach",
      label: "Send your first outreach email",
      done: (dash?.outreach?.sent ?? 0) > 0 || (dash?.outreach?.replied ?? 0) > 0,
      href: "/app/outreach",
      desc: "Compose or AI-generate a pitch from a contact",
    },
    {
      key: "agent",
      label: "Run the AI agent autonomously",
      done: (dash?.agent?.completed ?? 0) > 0,
      href: "/app/agent",
      desc: "Let the agent research, draft, and send pitches for you",
    },
  ];

  const completedCount = steps.filter(s => s.done).length;
  const allDone = completedCount === steps.length;

  function dismiss() {
    try { localStorage.setItem("onboarding_dismissed", "1"); } catch {}
    setDismissed(true);
  }

  if (dismissed) return null;
  if (allDone && completedCount === steps.length) return null;

  const pct = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 via-transparent to-violet-500/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-semibold">Getting started with LeadPilot</p>
            <p className="text-xs text-muted-foreground">{completedCount} of {steps.length} steps complete</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Progress bar */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-24 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{pct}%</span>
          </div>
          <button
            onClick={() => setOpen(o => !o)}
            className="text-zinc-600 hover:text-zinc-400 transition-colors p-1"
          >
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={dismiss}
            className="text-zinc-700 hover:text-zinc-500 transition-colors p-1"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Steps */}
      {open && (
        <div className="grid sm:grid-cols-2 gap-px bg-border/20">
          {steps.map((step, i) => (
            <Link href={step.href} key={step.key}>
              <div className={cn(
                "flex items-start gap-3 p-3.5 transition-colors cursor-pointer bg-background/40",
                step.done ? "opacity-60" : "hover:bg-indigo-500/5"
              )}>
                {step.done ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-indigo-500/40 shrink-0 mt-0.5 flex items-center justify-center">
                    <span className="text-[9px] text-indigo-400 font-bold">{i + 1}</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className={cn("text-xs font-medium", step.done ? "line-through text-muted-foreground" : "text-zinc-200")}>
                    {step.label}
                  </p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">{step.desc}</p>
                </div>
                {!step.done && <ArrowRight className="w-3 h-3 text-zinc-700 ml-auto shrink-0 mt-0.5" />}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function TopCompaniesWidget() {
  const { data: companies, isLoading } = useQuery({
    queryKey: ["analytics", "top-companies"],
    queryFn: () => api.get<any[]>("/analytics/top-companies"),
  });

  if (isLoading) return null;
  if (!companies || companies.length === 0) return null;

  return (
    <Card className="gradient-top-border-blue bg-card/50 border-border/50 hover-glow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-400" /> Top Companies
          </CardTitle>
          <Link href="/app/companies">
            <Button variant="ghost" size="sm" className="text-xs h-7">View all <ArrowRight className="w-3 h-3" /></Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {companies.slice(0, 10).map((c: any) => (
            <div key={c.name} className="flex items-center gap-2 p-2 rounded-lg bg-accent/20 hover:bg-accent/40 border border-border/30 hover:border-border/60 transition-all min-w-0">
              <div className="w-6 h-6 rounded shrink-0 bg-blue-500/20 flex items-center justify-center overflow-hidden">
                {c.domain ? (
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${c.domain}&sz=16`}
                    alt=""
                    className="w-4 h-4 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <Building2 className="w-3 h-3 text-blue-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{c.name}</p>
                <p className="text-[10px] text-muted-foreground">{c.jobCount}j{c.contactCount > 0 ? ` · ${c.contactCount}c` : ""}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const STAT_CARD_STYLES: Record<string, { icon: string; glow: string; border: string; bar?: string }> = {
  indigo: { icon: "text-indigo-400 bg-indigo-500/10",  glow: "", border: "gradient-top-border" },
  violet: { icon: "text-violet-400 bg-violet-500/10",  glow: "", border: "gradient-top-border-violet" },
  green:  { icon: "text-green-400  bg-green-500/10",   glow: "", border: "gradient-top-border-green" },
  blue:   { icon: "text-blue-400   bg-blue-500/10",    glow: "", border: "gradient-top-border-blue" },
  yellow: { icon: "text-yellow-400 bg-yellow-500/10",  glow: "", border: "gradient-top-border-yellow" },
  pink:   { icon: "text-pink-400   bg-pink-500/10",    glow: "", border: "gradient-top-border-pink" },
};

function StatCard({ icon: Icon, label, value, sub, color = "indigo" }: any) {
  const s = STAT_CARD_STYLES[color] || STAT_CARD_STYLES.indigo;
  return (
    <Card className={cn(
      "relative bg-card/50 border-border/50 hover:border-border/80 transition-all duration-200 overflow-hidden hover-glow",
      s.border
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1.5">{label}</p>
            <p className="text-2xl font-bold tabular-nums">{value?.toLocaleString() ?? "—"}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
          </div>
          <div className={`w-9 h-9 rounded-lg ${s.icon} flex items-center justify-center shrink-0`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const FUNNEL_LABELS: Record<string, string> = {
  new: "New", classified: "Classified", enriched: "Enriched",
  pitched: "Pitched", replied: "Replied", won: "Won",
};

const FUNNEL_COLORS = ["#6366f1", "#818cf8", "#a78bfa", "#c4b5fd", "#4ade80", "#22c55e"];

export default function DashboardPage() {
  const { user, workspace } = useAuth();
  const qc = useQueryClient();

  const { data: dash, isLoading } = useQuery<DashboardData>({
    queryKey: ["analytics", "dashboard"],
    queryFn: () => api.get("/analytics/dashboard"),
  });

  const { data: jobsOverTime } = useQuery({
    queryKey: ["analytics", "jobs-over-time"],
    queryFn: () => api.get<any[]>("/analytics/jobs-over-time"),
  });

  const { data: outreachOverTime } = useQuery({
    queryKey: ["analytics", "outreach-over-time"],
    queryFn: () => api.get<any[]>("/analytics/outreach-over-time"),
  });

  const { data: creditsOverTime } = useQuery({
    queryKey: ["analytics", "credits-over-time"],
    queryFn: () => api.get<any[]>("/analytics/credits-over-time"),
  });

  const planMax: Record<string, number> = { free: 50, pro: 2000, agency: 10000, scale: 100000 };
  const creditMax = planMax[dash?.credits.plan || "free"] || 50;
  const isEmpty = !isLoading && (dash?.jobs.total ?? 0) === 0;

  const funnelData = Object.entries(FUNNEL_LABELS).map(([key, label], i) => ({
    name: label,
    value: dash?.funnel[key] || 0,
    color: FUNNEL_COLORS[i] || "#6366f1",
    key,
  }));

  const greeting = new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening";

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Good {greeting}, {user?.firstName}
            <span className="text-xl">👋</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Here's your prospecting overview</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => qc.invalidateQueries({ queryKey: ["analytics"] })}
            title="Refresh dashboard"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Link href="/app/jobs">
            <Button variant="outline" size="sm" className="border-border/60 hover:border-border">
              <Briefcase className="w-4 h-4" /> Browse jobs
            </Button>
          </Link>
          <Link href="/app/signals">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 shadow-sm shadow-indigo-500/20">
              <Zap className="w-4 h-4" /> View signals
            </Button>
          </Link>
        </div>
      </div>

      {/* Onboarding checklist — auto-hides when all done or dismissed */}
      <OnboardingChecklist dash={dash} />

      {/* Quick actions strip */}
      {!isEmpty && !isLoading && (
        <div className="flex flex-wrap gap-2">
          {[
            { href: "/app/jobs", icon: Briefcase, label: "Browse jobs" },
            { href: "/app/contacts", icon: Users, label: "View contacts" },
            { href: "/app/signals", icon: Zap, label: "Signals", extra: (dash?.signals.strong || 0) > 0 ? <span className="ml-1 text-yellow-400 font-bold">{dash?.signals.strong} strong</span> : null },
            { href: "/app/outreach", icon: Mail, label: "Outreach" },
            { href: "/app/agent", icon: Bot, label: "Agent runs" },
          ].map(({ href, icon: Icon, label, extra }) => (
            <Link key={href} href={href}>
              <Button variant="outline" size="sm" className="h-8 text-xs border-border/50 hover:border-border/80">
                <Icon className="w-3.5 h-3.5" /> {label}{extra}
              </Button>
            </Link>
          ))}
        </div>
      )}

      {/* Quick-start onboarding banner */}
      {isEmpty && (
        <div className="relative rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-6 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
          <div className="absolute inset-0 shimmer-bg" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h2 className="font-semibold text-indigo-300">Welcome to LeadPilot 2.0</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Get started in 3 steps: scrape jobs → enrich contacts → send your first pitch.
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { step: "1", title: "Scrape jobs", desc: "Pull from Upwork, RemoteOK, Indeed and more", href: "/app/jobs", label: "Go to Jobs", color: "text-indigo-400 bg-indigo-500/15" },
                { step: "2", title: "Add API keys", desc: "Enable waterfall enrichment with your own keys", href: "/app/settings/api-keys", label: "Add keys", color: "text-violet-400 bg-violet-500/15" },
                { step: "3", title: "Send a pitch", desc: "AI drafts the email — you review and send", href: "/app/outreach", label: "Compose", color: "text-green-400 bg-green-500/15" },
              ].map(({ step, title, desc, href, label, color }) => (
                <Link key={step} href={href}>
                  <div className="rounded-xl border border-border/50 bg-card/50 p-4 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all cursor-pointer group">
                    <div className={cn("w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center mb-3", color)}>{step}</div>
                    <div className="font-medium text-sm mb-1">{title}</div>
                    <div className="text-xs text-muted-foreground mb-3">{desc}</div>
                    <span className="text-xs text-indigo-400 font-medium group-hover:text-indigo-300 transition-colors">{label} →</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard icon={Briefcase} label="Total Jobs" value={dash?.jobs.total} sub={`${dash?.pipeline?.active || 0} active in pipeline`} color="indigo" />
          <StatCard icon={Users} label="Contacts" value={dash?.contacts.total} sub={`${dash?.contacts.verified} verified`} color="violet" />
          <StatCard icon={Building2} label="Companies" value={dash?.companies.total} color="blue" />
          <StatCard icon={Zap} label="Intent Signals" value={dash?.signals.total} sub={`${dash?.signals.strong} strong`} color="yellow" />
          <StatCard icon={Mail} label="Emails Sent" value={dash?.outreach.sent} sub={`${dash?.outreach.openRate}% open rate`} color="green" />
          <StatCard icon={TrendingUp} label="Reply Rate" value={`${dash?.outreach.replyRate}%`} sub={`${dash?.outreach.replied} replies`} color="pink" />
          <StatCard icon={Bot} label="Agent Runs" value={dash?.agent?.total ?? 0} sub={`${dash?.agent?.completed ?? 0} completed`} color="indigo" />
          <StatCard icon={CreditCard} label="Credits Left" value={dash?.credits.balance} sub={`${dash?.credits.plan} plan`} color="violet" />
          <StatCard
            icon={Target}
            label="Pipeline Value"
            value={dash?.pipeline?.budgetSum ? `$${(dash.pipeline.budgetSum / 1000).toFixed(1)}k` : "$0"}
            sub={`${dash?.pipeline?.won ?? 0} won · ${dash?.pipeline?.active ?? 0} active`}
            color="green"
          />
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Activity chart */}
        <Card className="md:col-span-2 gradient-top-border bg-card/50 border-border/50 hover-glow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" /> Activity (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Jobs discovered</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <AreaChart data={jobsOverTime || []}>
                      <defs>
                        <linearGradient id="jobGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#52525b" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#52525b" }} tickLine={false} axisLine={false} width={24} />
                      <Tooltip
                        contentStyle={{ background: "#0f0f14", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", fontSize: "11px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
                        labelStyle={{ color: "#71717a" }}
                        itemStyle={{ color: "#818cf8" }}
                      />
                      <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#jobGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {outreachOverTime && outreachOverTime.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Outreach sent</p>
                    <ResponsiveContainer width="100%" height={100}>
                      <AreaChart data={outreachOverTime}>
                        <defs>
                          <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#52525b" }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#52525b" }} tickLine={false} axisLine={false} width={24} />
                        <Tooltip
                          contentStyle={{ background: "#0f0f14", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px", fontSize: "11px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
                          labelStyle={{ color: "#71717a" }}
                          itemStyle={{ color: "#4ade80" }}
                        />
                        <Area type="monotone" dataKey="sent" stroke="#22c55e" strokeWidth={2} fill="url(#outGrad)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Credits panel */}
        <Card className="gradient-top-border-violet bg-card/50 border-border/50 hover-glow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-violet-400" /> Credits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              {(() => {
                const pct = Math.min(100, ((dash?.credits.balance || 0) / creditMax) * 100);
                const isLow = pct < 15;
                const isMed = pct < 40;
                return (
                  <>
                    <div className="flex justify-between text-sm mb-3">
                      <span className="text-muted-foreground">Balance</span>
                      <span className={`font-bold tabular-nums ${isLow ? "text-red-400" : isMed ? "text-yellow-400" : "text-violet-400"}`}>
                        {dash?.credits.balance?.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted/30 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${isLow ? "bg-red-500" : isMed ? "bg-yellow-500" : "bg-gradient-to-r from-indigo-500 to-violet-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {isLow && <p className="text-[10px] text-red-400 mt-1.5">Low balance — top up soon</p>}
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>0</span>
                      <span>{creditMax.toLocaleString()}</span>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="text-xs text-muted-foreground space-y-1.5 pt-1 border-t border-border/30">
              <div className="flex justify-between">
                <span>Plan</span>
                <span className="font-medium capitalize text-foreground">{dash?.credits.plan}</span>
              </div>
              <div className="flex justify-between">
                <span>Used this month</span>
                <span className="font-medium text-foreground">{Number(dash?.credits.usedThisMonth || 0).toFixed(1)}</span>
              </div>
            </div>
            <Link href="/app/settings/billing">
              <Button variant="outline" size="sm" className="w-full border-border/60 hover:border-violet-500/40 hover:text-violet-300 transition-colors">
                Upgrade plan <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Funnel */}
        <Card className="gradient-top-border bg-card/50 border-border/50 hover-glow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" /> Pipeline funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {funnelData.filter(f => f.value > 0 || true).slice(0, 6).map((item) => {
                  const max = Math.max(...funnelData.map(f => f.value), 1);
                  return (
                    <Link key={item.name} href={`/app/jobs?status=${item.key}`}>
                      <div className="flex items-center gap-3 group cursor-pointer rounded-lg hover:bg-accent/30 px-1 py-0.5 transition-colors">
                        <div className="w-20 text-xs text-muted-foreground shrink-0 group-hover:text-foreground transition-colors">{item.name}</div>
                        <div className="flex-1 h-5 rounded-full bg-muted/30 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${(item.value / max) * 100}%`, background: item.color }}
                          />
                        </div>
                        <div className="text-xs font-medium tabular-nums w-8 text-right">{item.value}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent signals */}
        <Card className="gradient-top-border-yellow bg-card/50 border-border/50 hover-glow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" /> Recent signals
              </CardTitle>
              <Link href="/app/signals">
                <Button variant="ghost" size="sm" className="text-xs h-7">View all <ArrowRight className="w-3 h-3" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : dash?.recent.signals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Zap className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm font-medium mb-1">No signals yet</p>
                <p className="text-xs">Scrape jobs to generate intent signals</p>
              </div>
            ) : (
              <div className="space-y-1">
                {dash?.recent.signals.map((signal: any) => (
                  <div key={signal.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/40 transition-colors">
                    <span className="text-lg">{getSignalIcon(signal.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{signal.title}</p>
                      <p className="text-xs text-muted-foreground">{formatRelativeTime(signal.detectedAt)}</p>
                    </div>
                    <Badge variant={signal.strength === "strong" ? "success" : "secondary"} className="text-[10px] shrink-0">
                      {signal.strength}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Credits over time */}
      {creditsOverTime && creditsOverTime.length > 0 && (
        <Card className="gradient-top-border bg-card/50 border-border/50 hover-glow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-400" /> Credit usage — last 30 days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={creditsOverTime}>
                <defs>
                  <linearGradient id="creditGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: "#0f0f14", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
                  formatter={(v: any) => [`${Number(v).toFixed(1)} credits`, "Used"]}
                  labelStyle={{ color: "#71717a" }}
                />
                <Area type="monotone" dataKey="credits" stroke="#6366f1" strokeWidth={2} fill="url(#creditGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top companies */}
      <TopCompaniesWidget />

      {/* Recent jobs + outreach */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="gradient-top-border bg-card/50 border-border/50 hover-glow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-400" /> Recent jobs
              </CardTitle>
              <Link href="/app/jobs">
                <Button variant="ghost" size="sm" className="text-xs h-7">View all <ArrowRight className="w-3 h-3" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : dash?.recent.jobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm font-medium mb-1">No jobs yet</p>
                <Link href="/app/jobs">
                  <Button size="sm" className="mt-2 bg-indigo-600 hover:bg-indigo-500">Start scraping</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {dash?.recent.jobs.map((job: any) => (
                  <Link key={job.id} href={`/app/jobs/${job.id}`}>
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/40 transition-colors cursor-pointer" data-testid={`card-job-${job.id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">{job.title}</p>
                          <Badge className={`text-[10px] ${getPlatformColor(job.platform)}`}>{job.platform}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{job.companyName || "Unknown"} · {formatRelativeTime(job.discoveredAt)}</p>
                      </div>
                      <Badge className={`text-[10px] ${getStatusColor(job.status)} shrink-0`}>{job.status}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="gradient-top-border-green bg-card/50 border-border/50 hover-glow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Mail className="w-4 h-4 text-green-400" /> Recent outreach
              </CardTitle>
              <Link href="/app/outreach">
                <Button variant="ghost" size="sm" className="text-xs h-7">View all <ArrowRight className="w-3 h-3" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (dash?.outreach.total ?? 0) === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm font-medium mb-1">No outreach yet</p>
                <Link href="/app/outreach">
                  <Button size="sm" variant="outline" className="mt-2">Compose email</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {(dash?.recent?.outreach || []).map((item: any) => (
                  <Link key={item.id} href="/app/outreach">
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/40 transition-colors cursor-pointer">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{item.subject || "(no subject)"}</p>
                        <p className="text-xs text-muted-foreground">{formatRelativeTime(item.sentAt || item.createdAt)}</p>
                      </div>
                      <Badge className={`text-[10px] ${getStatusColor(item.status)} shrink-0`}>{item.status}</Badge>
                    </div>
                  </Link>
                ))}
                <div className="pt-2 border-t border-border/30">
                  <p className="text-[11px] text-center text-muted-foreground">
                    {dash?.outreach.openRate}% open rate · {dash?.outreach.replyRate}% reply rate
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
