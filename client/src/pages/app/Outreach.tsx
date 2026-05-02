import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getStatusColor, formatRelativeTime, truncate } from "@/lib/utils";
import { Mail, ChevronLeft, ChevronRight, Send, Eye, MessageSquare } from "lucide-react";

export default function OutreachPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");

  const params = new URLSearchParams({ page: page.toString(), limit: "25", ...(statusFilter !== "all" && { status: statusFilter }) });

  const { data, isLoading } = useQuery({
    queryKey: ["outreach", page, statusFilter],
    queryFn: () => api.get<any>(`/outreach?${params}`),
  });

  const { data: stats } = useQuery({
    queryKey: ["outreach", "stats"],
    queryFn: () => api.get<any>("/outreach/stats"),
  });

  const outreachItems = data?.outreach || [];
  const pagination = data?.pagination || { total: 0, pages: 1 };
  const byStatus = stats?.byStatus || {};

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="w-6 h-6 text-green-400" /> Outreach
          </h1>
          <p className="text-sm text-muted-foreground">{pagination.total} total emails</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Draft", key: "draft", icon: Mail, color: "text-zinc-400" },
          { label: "Sent", key: "sent", icon: Send, color: "text-blue-400" },
          { label: "Opened", key: "opened", icon: Eye, color: "text-indigo-400" },
          { label: "Replied", key: "replied", icon: MessageSquare, color: "text-green-400" },
          { label: "Bounced", key: "bounced", icon: Mail, color: "text-red-400" },
        ].map(({ label, key, icon: Icon, color }) => (
          <Card key={key} className="bg-card/50 border-border/50">
            <CardContent className="p-3 text-center">
              <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
              <div className="text-lg font-bold">{byStatus[key] || 0}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="opened">Opened</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : outreachItems.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Mail className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-semibold mb-1">No outreach yet</h3>
          <p className="text-sm text-muted-foreground">Generate emails from job details or run the agent</p>
        </div>
      ) : (
        <div className="space-y-2">
          {outreachItems.map((item: any) => (
            <Card key={item.id} className="bg-card/50 border-border/50 hover:border-indigo-500/20 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm">{item.subject}</span>
                      <Badge className={`text-[10px] ${getStatusColor(item.status)}`}>{item.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{truncate(item.body || "", 150)}</p>
                    <div className="text-xs text-muted-foreground mt-1.5">
                      {item.sentAt ? `Sent ${formatRelativeTime(item.sentAt)}` : `Created ${formatRelativeTime(item.createdAt)}`}
                    </div>
                  </div>
                  {item.status === "draft" && (
                    <Button size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-500 shrink-0">
                      <Send className="w-3 h-3" /> Send
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      )}
    </div>
  );
}
