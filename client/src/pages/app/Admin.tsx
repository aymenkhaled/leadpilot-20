import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Redirect } from "wouter";
import { Shield, Users, Building2, Briefcase, UserCheck, CreditCard, Pencil, Search, Bot, ShieldCheck, ShieldOff, Coins, Mail, Webhook, ChevronDown, ChevronUp, RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";
import { formatDate, formatRelativeTime } from "@/lib/utils";

const PLAN_COLORS: Record<string, string> = {
  free: "bg-zinc-500/20 text-zinc-400",
  pro: "bg-indigo-500/20 text-indigo-400",
  agency: "bg-violet-500/20 text-violet-400",
  scale: "bg-yellow-500/20 text-yellow-400",
};

function EditWorkspaceDialog({ ws, onClose }: { ws: any; onClose: () => void }) {
  const [credits, setCredits] = useState(parseFloat(ws?.credits || "0").toFixed(0));
  const [plan, setPlan] = useState(ws?.plan || "free");
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => api.patch(`/admin/workspaces/${ws.id}`, { credits: parseFloat(credits), plan }),
    onSuccess: () => {
      toast({ title: "Workspace updated" });
      qc.invalidateQueries({ queryKey: ["admin"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={!!ws} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Workspace</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs text-muted-foreground">Workspace</Label>
            <p className="font-medium text-sm mt-0.5">{ws?.name}</p>
          </div>
          <div>
            <Label>Credits</Label>
            <Input
              type="number"
              value={credits}
              onChange={e => setCredits(e.target.value)}
              className="mt-1"
              min="0"
              step="10"
            />
            <p className="text-xs text-muted-foreground mt-1">Current: {parseFloat(ws?.credits || "0").toFixed(1)}</p>
          </div>
          <div>
            <Label>Plan</Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="agency">Agency</SelectItem>
                <SelectItem value="scale">Scale</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-500" onClick={() => mutation.mutate()} loading={mutation.isPending}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const [editWs, setEditWs] = useState<any>(null);
  const [wsSearch, setWsSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");

  if (!user?.isAdmin) return <Redirect to="/app/dashboard" />;

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => api.get<any>("/admin/stats"),
  });

  const { data: workspaces, isLoading: wsLoading } = useQuery({
    queryKey: ["admin", "workspaces"],
    queryFn: () => api.get<any[]>("/admin/workspaces"),
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api.get<any[]>("/admin/users"),
  });

  const qc = useQueryClient();

  const promoteMutation = useMutation({
    mutationFn: (userId: string) => api.patch(`/admin/users/${userId}/promote`, {}),
    onSuccess: (data: any) => {
      toast({ title: data.isAdmin ? "User promoted to admin" : "Admin access revoked" });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: any) => toast({ title: "Action failed", description: e.message, variant: "destructive" }),
  });

  const grantCreditsMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      api.post(`/admin/workspaces/${id}/grant-credits`, { amount }),
    onSuccess: () => {
      toast({ title: "Credits granted" });
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const STAT_CARDS = [
    { label: "Total users", value: stats?.users, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", gradient: "gradient-top-border-blue" },
    { label: "Workspaces", value: stats?.workspaces, icon: Building2, color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20", gradient: "gradient-top-border", sub: stats?.paidWorkspaces != null ? `${stats.paidWorkspaces} paid` : undefined },
    { label: "Total jobs", value: stats?.jobs, icon: Briefcase, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", gradient: "gradient-top-border-green" },
    { label: "Contacts", value: stats?.contacts, icon: UserCheck, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20", gradient: "gradient-top-border-violet" },
    { label: "Outreach sent", value: stats?.outreach, icon: Mail, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", gradient: "gradient-top-border-blue" },
    { label: "Agent Runs", value: stats?.agentRuns, icon: Bot, color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20", gradient: "gradient-top-border" },
    { label: "Paid plans", value: stats?.paidWorkspaces, icon: CreditCard, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", gradient: "gradient-top-border-yellow" },
    { label: "Total Credits", value: stats?.totalCredits?.toLocaleString(), icon: Coins, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", gradient: "gradient-top-border-green", sub: "across all workspaces" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Restricted access — admin only</p>
        </div>
        <Badge className="ml-auto text-xs bg-red-500/20 text-red-400 border-red-500/30 border">Super Admin</Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ label, value, icon: Icon, color, bg, border, gradient, sub }) => (
          <Card key={label} className={`${gradient} bg-card/50 border-border/50 hover-glow transition-all`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-8 h-8 rounded-lg ${bg} border ${border} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {statsLoading ? <Skeleton className="h-7 w-16" /> : (value ?? 0)?.toLocaleString?.() ?? value}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{label}</div>
              {sub && <div className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Workspaces */}
        <Card className="gradient-top-border bg-card/50 border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                Workspaces
                {workspaces && (
                  <span className="text-xs text-muted-foreground font-normal">({workspaces.length})</span>
                )}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter workspaces..."
                className="pl-8 h-8 text-xs"
                value={wsSearch}
                onChange={e => setWsSearch(e.target.value)}
              />
            </div>
            {wsLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                {(workspaces || [])
                  .filter((ws: any) => !wsSearch || ws.name?.toLowerCase().includes(wsSearch.toLowerCase()))
                  .map((ws: any) => (
                    <div key={ws.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-accent/50 border border-transparent hover:border-border/50 group transition-all">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{ws.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                          <span>{formatDate(ws.createdAt)}</span>
                          {ws.userCount > 0 && <span className="text-blue-400/70">{ws.userCount}u</span>}
                          {ws.jobCount > 0 && <span className="text-indigo-400/70">{ws.jobCount}j</span>}
                          {ws.contactCount > 0 && <span className="text-violet-400/70">{ws.contactCount}c</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Coins className="w-3 h-3 text-yellow-400/70" />
                          {parseFloat(ws.credits || "0").toFixed(0)}
                        </span>
                        <Badge className={`text-[10px] ${PLAN_COLORS[ws.plan] || PLAN_COLORS.free}`}>{ws.plan}</Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-yellow-400 hover:bg-yellow-500/10"
                          onClick={() => {
                            const amt = prompt(`Grant credits to "${ws.name}" (current: ${parseFloat(ws.credits || "0").toFixed(0)}):`);
                            if (amt && !isNaN(parseFloat(amt))) grantCreditsMutation.mutate({ id: ws.id, amount: parseFloat(amt) });
                          }}
                          title="Grant credits"
                        >
                          <Coins className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400 hover:bg-indigo-500/10"
                          onClick={() => setEditWs(ws)}
                          title="Edit workspace"
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Users */}
        <Card className="gradient-top-border-violet bg-card/50 border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-violet-400" />
                </div>
                Users
                {users && (
                  <span className="text-xs text-muted-foreground font-normal">({users.length})</span>
                )}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter users..."
                className="pl-8 h-8 text-xs"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
              />
            </div>
            {usersLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                {(users || [])
                  .filter((u: any) => !userSearch || `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(userSearch.toLowerCase()))
                  .map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-accent/50 border border-transparent hover:border-border/50 group transition-all">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{u.firstName} {u.lastName}</div>
                        <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                          <span className="truncate max-w-[140px]">{u.email}</span>
                          {u.workspaceName && <span className="text-zinc-600 shrink-0">· {u.workspaceName}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {u.isAdmin && (
                          <Badge variant="destructive" className="text-[10px]">Admin</Badge>
                        )}
                        {u.workspacePlan && u.workspacePlan !== "free" && (
                          <Badge className={`text-[10px] ${PLAN_COLORS[u.workspacePlan] || PLAN_COLORS.free}`}>{u.workspacePlan}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground/60">{formatDate(u.createdAt)}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            if (confirm(`${u.isAdmin ? "Revoke admin from" : "Promote"} ${u.email}?`)) {
                              promoteMutation.mutate(u.id);
                            }
                          }}
                          title={u.isAdmin ? "Revoke admin" : "Promote to admin"}
                        >
                          {u.isAdmin
                            ? <ShieldOff className="w-3 h-3 text-red-400" />
                            : <ShieldCheck className="w-3 h-3 text-green-400" />
                          }
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Webhook Event Log */}
      <WebhookEventLog />

      {editWs && <EditWorkspaceDialog ws={editWs} onClose={() => setEditWs(null)} />}
    </div>
  );
}

function WebhookEventLog() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: hooks, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin", "webhooks"],
    queryFn: () => api.get<any[]>("/webhooks"),
    staleTime: 30_000,
  });

  return (
    <Card className="gradient-top-border-violet bg-card/50 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Webhook className="w-3.5 h-3.5 text-violet-400" />
            </div>
            Webhook Endpoints
            {hooks && (
              <span className="text-xs text-muted-foreground font-normal">({hooks.length})</span>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={() => refetch()}
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : !hooks || hooks.length === 0 ? (
          <div className="text-center py-8">
            <Webhook className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
            <p className="text-sm text-zinc-600 mb-1">No webhooks configured</p>
            <p className="text-xs text-zinc-700">Users can register webhooks from the Settings page</p>
          </div>
        ) : (
          <div className="space-y-2">
            {hooks.map((hook: any) => (
              <div key={hook.id} className="rounded-xl border border-border/40 bg-card/30 overflow-hidden">
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpanded(expanded === hook.id ? null : hook.id)}
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${hook.isActive ? "bg-green-400" : "bg-zinc-600"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-medium text-zinc-300 truncate">{hook.url}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {(hook.events || []).slice(0, 3).map((e: string) => (
                        <Badge key={e} variant="outline" className="text-[9px] px-1 py-0">{e}</Badge>
                      ))}
                      {(hook.events || []).length > 3 && (
                        <span className="text-[10px] text-zinc-600">+{(hook.events || []).length - 3}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {hook.lastFiredAt ? (
                      <div className="flex items-center gap-1 text-[10px] text-zinc-600">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{formatRelativeTime(hook.lastFiredAt)}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-zinc-700">Never fired</span>
                    )}
                    <Badge className={`text-[9px] ${hook.isActive ? "bg-green-500/20 text-green-400" : "bg-zinc-500/20 text-zinc-500"}`}>
                      {hook.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {expanded === hook.id ? <ChevronUp className="w-3 h-3 text-zinc-600" /> : <ChevronDown className="w-3 h-3 text-zinc-600" />}
                  </div>
                </div>

                {expanded === hook.id && (
                  <div className="px-4 pb-3 pt-0 border-t border-border/30 bg-black/20">
                    <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                      <div>
                        <p className="text-zinc-600 mb-0.5">Endpoint URL</p>
                        <p className="text-zinc-300 font-mono text-[11px] break-all">{hook.url}</p>
                      </div>
                      <div>
                        <p className="text-zinc-600 mb-0.5">Created</p>
                        <p className="text-zinc-400">{formatDate(hook.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-zinc-600 mb-0.5">Events</p>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {(hook.events || []).map((e: string) => (
                            <Badge key={e} variant="outline" className="text-[9px]">{e}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-zinc-600 mb-0.5">Last fired</p>
                        <p className="text-zinc-400">{hook.lastFiredAt ? formatRelativeTime(hook.lastFiredAt) : "—"}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
