import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime, getSignalIcon, getSignalColor, getStatusColor } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);

  const { data: signalStats } = useQuery({
    queryKey: ["signals", "stats"],
    queryFn: () => api.get<any>("/signals/stats"),
    refetchInterval: 30000,
  });

  const { data: agentData } = useQuery({
    queryKey: ["agent-runs-recent-notif"],
    queryFn: () => api.get<any>("/agent/runs?limit=5&status=completed"),
    refetchInterval: 15000,
  });

  const { data: recentSignals } = useQuery({
    queryKey: ["signals-recent-notif"],
    queryFn: () => api.get<any>("/signals?limit=5&sort=newest"),
    enabled: open,
    staleTime: 20000,
  });

  const unactedSignals = signalStats?.unacted || 0;
  const pendingApprovals = (agentData?.runs || []).filter((r: any) => r.result?.emailDraft && r.result?.contactId).length;
  const totalCount = Math.min(99, unactedSignals + pendingApprovals);

  const signals: any[] = recentSignals?.signals || [];
  const agentRuns: any[] = agentData?.runs || [];

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-zinc-600 hover:text-zinc-300 relative"
        onClick={() => setOpen(!open)}
        title="Notifications"
      >
        <Bell className="w-3.5 h-3.5" />
        {totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center leading-none">
            {totalCount > 9 ? "9+" : totalCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 bottom-10 z-50 w-80 rounded-xl border border-border/60 bg-[#0d0d12] shadow-2xl shadow-black/60 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-sm font-semibold">Notifications</span>
              </div>
              {totalCount > 0 && (
                <Badge className="text-[10px] bg-red-500/20 text-red-400">{totalCount} new</Badge>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {/* Pending agent approvals */}
              {agentRuns.filter((r: any) => r.result?.emailDraft && r.result?.contactId).map((run: any) => (
                <Link href="/app/agent" key={run.id}>
                  <div
                    className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors border-b border-border/30 cursor-pointer"
                    onClick={() => setOpen(false)}
                  >
                    <div className="w-7 h-7 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0 text-sm">✍️</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-200 truncate">Draft ready for approval</p>
                      <p className="text-[11px] text-zinc-500 truncate">{run.jobTitle || "Agent run"}</p>
                      <p className="text-[10px] text-zinc-700 mt-0.5">{formatRelativeTime(run.createdAt)}</p>
                    </div>
                    <Badge className="text-[10px] bg-green-500/20 text-green-400 shrink-0">Approve</Badge>
                  </div>
                </Link>
              ))}

              {/* Recent signals */}
              {signals.slice(0, 5).map((signal: any) => (
                <Link href="/app/signals" key={signal.id}>
                  <div
                    className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors border-b border-border/30 cursor-pointer"
                    onClick={() => setOpen(false)}
                  >
                    <div className="w-7 h-7 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0 text-sm">
                      {getSignalIcon(signal.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-medium truncate", getSignalColor(signal.type))}>
                        {signal.type?.replace(/_/g, " ")}
                      </p>
                      <p className="text-[11px] text-zinc-500 truncate">{signal.companyName || "Unknown company"}</p>
                      <p className="text-[10px] text-zinc-700 mt-0.5">{formatRelativeTime(signal.detectedAt)}</p>
                    </div>
                    {!signal.actedOnAt && (
                      <Badge className="text-[10px] bg-yellow-500/20 text-yellow-400 shrink-0">New</Badge>
                    )}
                  </div>
                </Link>
              ))}

              {totalCount === 0 && signals.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <Bell className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-xs text-zinc-600">All caught up!</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-border/40 bg-[#09090d]">
              <Link href="/app/signals">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs text-zinc-600 hover:text-zinc-300"
                  onClick={() => setOpen(false)}
                >
                  View all signals →
                </Button>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
