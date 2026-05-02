import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Redirect } from "wouter";
import { Shield, Users, Building2, Briefcase, UserCheck, Activity } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function AdminPage() {
  const { user } = useAuth();
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

  const PLAN_COLORS: Record<string, string> = {
    free: "bg-zinc-500/20 text-zinc-400",
    pro: "bg-indigo-500/20 text-indigo-400",
    agency: "bg-violet-500/20 text-violet-400",
    scale: "bg-yellow-500/20 text-yellow-400",
  };

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total users", value: stats?.users, icon: Users, color: "text-blue-400" },
          { label: "Workspaces", value: stats?.workspaces, icon: Building2, color: "text-indigo-400" },
          { label: "Total jobs", value: stats?.jobs, icon: Briefcase, color: "text-green-400" },
          { label: "Contacts", value: stats?.contacts, icon: UserCheck, color: "text-violet-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-card/50 border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`w-8 h-8 ${color} opacity-70`} />
              <div>
                <div className="text-2xl font-bold">{statsLoading ? "—" : value?.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
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
            {wsLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {(workspaces || []).map((ws: any) => (
                  <div key={ws.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50">
                    <div>
                      <div className="text-sm font-medium">{ws.name}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(ws.createdAt)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{parseFloat(ws.credits || "0").toFixed(0)} cr</span>
                      <Badge className={`text-[10px] ${PLAN_COLORS[ws.plan] || PLAN_COLORS.free}`}>{ws.plan}</Badge>
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
            {usersLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {(users || []).map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50">
                    <div>
                      <div className="text-sm font-medium">{u.firstName} {u.lastName}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {u.isAdmin && <Badge variant="destructive" className="text-[10px]">Admin</Badge>}
                      <span className="text-xs text-muted-foreground">{formatDate(u.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
