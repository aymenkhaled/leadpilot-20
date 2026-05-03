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
import { Shield, Users, Building2, Briefcase, UserCheck, CreditCard, Pencil, Search, Bot, ShieldCheck, ShieldOff, Coins, Mail } from "lucide-react";
import { formatDate } from "@/lib/utils";

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

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-red-400" />
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Restricted access — admin only</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[
          { label: "Total users", value: stats?.users, icon: Users, color: "text-blue-400" },
          { label: "Workspaces", value: stats?.workspaces, icon: Building2, color: "text-indigo-400", sub: stats?.paidWorkspaces != null ? `${stats.paidWorkspaces} paid` : undefined },
          { label: "Total jobs", value: stats?.jobs, icon: Briefcase, color: "text-green-400" },
          { label: "Contacts", value: stats?.contacts, icon: UserCheck, color: "text-violet-400" },
          { label: "Outreach sent", value: stats?.outreach, icon: Mail, color: "text-blue-400" },
          { label: "Agent Runs", value: stats?.agentRuns, icon: Bot, color: "text-indigo-400" },
          { label: "Paid plans", value: stats?.paidWorkspaces, icon: CreditCard, color: "text-yellow-400" },
          { label: "Total Credits", value: stats?.totalCredits?.toLocaleString(), icon: Coins, color: "text-green-400", sub: "across all workspaces" },
        ].map(({ label, value, icon: Icon, color, sub }: any) => (
          <Card key={label} className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <Icon className={`w-5 h-5 ${color} opacity-70 mb-1`} />
              <div className="text-2xl font-bold">{statsLoading ? "—" : (value ?? 0)?.toLocaleString?.() ?? value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
              {sub && <div className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Workspaces */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" /> Workspaces
            </CardTitle>
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
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {(workspaces || []).filter((ws: any) => !wsSearch || ws.name?.toLowerCase().includes(wsSearch.toLowerCase())).map((ws: any) => (
                  <div key={ws.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 group">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{ws.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        {formatDate(ws.createdAt)}
                        {ws.userCount > 0 && <span className="text-blue-400/70">{ws.userCount}u</span>}
                        {ws.jobCount > 0 && <span className="text-indigo-400/70">{ws.jobCount}j</span>}
                        {ws.contactCount > 0 && <span className="text-violet-400/70">{ws.contactCount}c</span>}
                        <span className="text-zinc-600">{ws.id.slice(0, 8)}…</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />
                        {parseFloat(ws.credits || "0").toFixed(0)}
                      </span>
                      <Badge className={`text-[10px] ${PLAN_COLORS[ws.plan] || PLAN_COLORS.free}`}>{ws.plan}</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          const amt = prompt(`Grant credits to "${ws.name}" (current: ${parseFloat(ws.credits || "0").toFixed(0)}):`);
                          if (amt && !isNaN(parseFloat(amt))) grantCreditsMutation.mutate({ id: ws.id, amount: parseFloat(amt) });
                        }}
                        title="Grant credits"
                      >
                        <Coins className="w-3 h-3 text-yellow-400" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
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
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" /> Users
            </CardTitle>
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
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {(users || []).filter((u: any) => !userSearch || `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(userSearch.toLowerCase())).map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 group">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{u.firstName} {u.lastName}</div>
                      <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                        <span>{u.email}</span>
                        {u.workspaceName && <span className="text-zinc-600">· {u.workspaceName}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {u.isAdmin && <Badge variant="destructive" className="text-[10px]">Admin</Badge>}
                      {u.workspacePlan && u.workspacePlan !== "free" && (
                        <Badge className={`text-[10px] ${PLAN_COLORS[u.workspacePlan] || PLAN_COLORS.free}`}>{u.workspacePlan}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{formatDate(u.createdAt)}</span>
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
                        {u.isAdmin ? <ShieldOff className="w-3 h-3 text-red-400" /> : <ShieldCheck className="w-3 h-3 text-green-400" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {editWs && <EditWorkspaceDialog ws={editWs} onClose={() => setEditWs(null)} />}
    </div>
  );
}
