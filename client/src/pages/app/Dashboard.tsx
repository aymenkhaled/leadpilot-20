import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { formatRelativeTime, getSignalIcon, getSignalColor, formatBudget, getPlatformColor, getStatusColor, cn } from "@/lib/utils";
import { Link } from "wouter";
import {
  Briefcase, Users, Building2, Mail, Zap, Bot, TrendingUp, ArrowRight,
  CreditCard, Target, Activity, BarChart3,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

interface DashboardData {
  jobs: { total: number };
  contacts: { total: number; verified: number };
  companies: { total: number };
  outreach: { total: number; sent: number; opened: number; replied: number; openRate: number; replyRate: number };
  signals: { total: number; strong: number };
  agent: { total: number; completed: number };
  funnel: Record<string, number>;
  credits: { balance: number; usedThisMonth: number; plan: string };
  recent: { jobs: any[]; signals: any[] };
}

function StatCard({ icon: Icon, label, value, sub, color = "indigo" }: any) {
  const colors: Record<string, string> = {
    indigo: "text-indigo-400 bg-indigo-500/10",
    violet: "text-violet-400 bg-violet-500/10",
    green: "text-green-400 bg-green-500/10",
    blue: "text-blue-400 bg-blue-500/10",
    yellow: "text-yellow-400 bg-yellow-500/10",
    pink: "text-pink-400 bg-pink-500/10",
  };
  return (
    <Card className="bg-card/50 border-border/50 hover:border-indigo-500/30 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
            <p className="text-2xl font-bold">{value?.toLocaleString() ?? "—"}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`w-9 h-9 rounded-lg ${colors[color]} flex items-center justify-center shrink-0`}>
            <Icon className="w-4.5 h-4.5" />
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

  const { data: dash, isLoading } = useQuery<DashboardData>({
    queryKey: ["analytics", "dashboard"],
    queryFn: () => api.get("/analytics/dashboard"),
  });

  const { data: jobsOverTime } = useQuery({
    queryKey: ["analytics", "jobs-over-time"],
    queryFn: () => api.get<any[]>("/analytics/jobs-over-time"),
  });

  const planMax: Record<string, number> = { free: 50, pro: 2000, agency: 10000, scale: 100000 };
  const creditMax = planMax[dash?.credits.plan || "free"] || 50;

  const funnelData = Object.entries(FUNNEL_LABELS).map(([key, label], i) => ({
    name: label,
    value: dash?.funnel[key] || 0,
    color: FUNNEL_COLORS[i] || "#6366f1",
  }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"},{" "}
            {user?.firstName} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Here's your prospecting overview</p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/jobs">
            <Button variant="outline" size="sm">
              <Briefcase className="w-4 h-4" /> Browse jobs
            </Button>
          </Link>
          <Link href="/app/signals">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500">
              <Zap className="w-4 h-4" /> View signals
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Briefcase} label="Total Jobs" value={dash?.jobs.total} sub="All time" color="indigo" />
          <StatCard icon={Users} label="Contacts" value={dash?.contacts.total} sub={`${dash?.contacts.verified} verified`} color="violet" />
          <StatCard icon={Building2} label="Companies" value={dash?.companies.total} color="blue" />
          <StatCard icon={Zap} label="Intent Signals" value={dash?.signals.total} sub={`${dash?.signals.strong} strong`} color="yellow" />
          <StatCard icon={Mail} label="Emails Sent" value={dash?.outreach.sent} sub={`${dash?.outreach.openRate}% open rate`} color="green" />
          <StatCard icon={TrendingUp} label="Reply Rate" value={`${dash?.outreach.replyRate}%`} sub={`${dash?.outreach.replied} replies`} color="pink" />
          <StatCard icon={Bot} label="Agent Runs" value={dash?.agent.total} sub={`${dash?.agent.completed} completed`} color="indigo" />
          <StatCard icon={CreditCard} label="Credits Left" value={dash?.credits.balance} sub={`${dash?.credits.plan} plan`} color="violet" />
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Jobs chart */}
        <Card className="md:col-span-2 bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" /> Jobs discovered (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={jobsOverTime || []}>
                  <defs>
                    <linearGradient id="jobGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#71717a" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#71717a" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#111113", border: "1px solid #27272a", borderRadius: "8px", fontSize: "12px" }}
                    labelStyle={{ color: "#a1a1aa" }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#jobGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Credits */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-400" /> Credits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Balance</span>
                <span className="font-bold text-indigo-400">{dash?.credits.balance?.toLocaleString()}</span>
              </div>
              <Progress value={Math.min(100, ((dash?.credits.balance || 0) / creditMax) * 100)} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0</span>
                <span>{creditMax.toLocaleString()}</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between"><span>Plan</span><span className="font-medium capitalize text-foreground">{dash?.credits.plan}</span></div>
              <div className="flex justify-between"><span>Used this month</span><span className="font-medium text-foreground">{Number(dash?.credits.usedThisMonth || 0).toFixed(1)}</span></div>
            </div>
            <Link href="/app/settings/billing">
              <Button variant="outline" size="sm" className="w-full">
                Upgrade plan <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Funnel */}
        <Card className="bg-card/50 border-border/50">
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
                    <div key={item.name} className="flex items-center gap-3">
                      <div className="w-20 text-xs text-muted-foreground shrink-0">{item.name}</div>
                      <div className="flex-1 h-5 rounded-full bg-muted/50 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${(item.value / max) * 100}%`, background: item.color }}
                        />
                      </div>
                      <div className="text-xs font-medium w-8 text-right">{item.value}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent signals */}
        <Card className="bg-card/50 border-border/50">
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
                <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No signals yet</p>
                <p className="text-xs mt-1">Scrape jobs to generate signals</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dash?.recent.signals.map((signal: any) => (
                  <div key={signal.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                    <span className="text-lg">{getSignalIcon(signal.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{signal.title}</p>
                      <p className="text-xs text-muted-foreground">{formatRelativeTime(signal.detectedAt)}</p>
                    </div>
                    <Badge variant={signal.strength === "strong" ? "success" : "secondary"} className="text-[10px]">
                      {signal.strength}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent jobs */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-400" /> Recently discovered jobs
            </CardTitle>
            <Link href="/app/jobs">
              <Button variant="ghost" size="sm" className="text-xs h-7">View all <ArrowRight className="w-3 h-3" /></Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : dash?.recent.jobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No jobs yet</p>
              <Link href="/app/jobs">
                <Button size="sm" className="mt-3 bg-indigo-600 hover:bg-indigo-500">Start scraping</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {dash?.recent.jobs.map((job: any) => (
                <Link key={job.id} href={`/app/jobs/${job.id}`}>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer" data-testid={`card-job-${job.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{job.title}</p>
                        <Badge className={`text-[10px] ${getPlatformColor(job.platform)}`}>{job.platform}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{job.companyName || "Unknown"} · {formatRelativeTime(job.discoveredAt)}</p>
                    </div>
                    <Badge className={`text-[10px] ${getStatusColor(job.status)}`}>{job.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
