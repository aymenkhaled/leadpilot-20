import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { getStatusColor, formatRelativeTime } from "@/lib/utils";
import { Bot, Play, X, ChevronDown, ChevronUp, CheckCircle, XCircle, Loader, Clock } from "lucide-react";

const STEP_ICONS: Record<string, any> = {
  research_account: "🔍",
  identify_decision_maker: "👤",
  draft_email: "✍️",
  send_email: "📤",
  awaiting_approval: "⏳",
  monitor_reply: "📬",
};

function AgentRunCard({ run }: { run: any }) {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/agent/runs/${run.id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-runs"] }),
    onError: (e: any) => toast({ title: "Failed to cancel", description: e.message, variant: "destructive" }),
  });

  const steps = (run.steps || []) as any[];

  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
            {run.status === "running" ? (
              <Loader className="w-4 h-4 text-indigo-400 animate-spin" />
            ) : run.status === "completed" ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : run.status === "failed" ? (
              <XCircle className="w-4 h-4 text-red-400" />
            ) : (
              <Clock className="w-4 h-4 text-zinc-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">Agent Run</span>
              <Badge className={`text-[10px] ${getStatusColor(run.status)}`}>{run.status}</Badge>
              <Badge variant="outline" className="text-[10px]">{run.approvalMode}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Started {formatRelativeTime(run.createdAt)}
              {run.completedAt && ` · Completed ${formatRelativeTime(run.completedAt)}`}
              {run.totalTokensUsed > 0 && ` · ${run.totalTokensUsed.toLocaleString()} tokens`}
            </div>

            {/* Steps */}
            {steps.length > 0 && (
              <div className="mt-3">
                <button
                  className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {steps.length} steps {expanded ? "(hide)" : "(show)"}
                </button>
                {expanded && (
                  <div className="mt-2 space-y-2">
                    {steps.map((step: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-xs bg-accent/30 rounded-lg p-2">
                        <span className="text-base">{STEP_ICONS[step.step] || "▪️"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium capitalize">{step.step.replace(/_/g, " ")}</div>
                          <div className="text-muted-foreground mt-0.5">
                            {typeof step.result === "string"
                              ? step.result
                              : step.result?.subject
                                ? `Subject: "${step.result.subject}"`
                                : JSON.stringify(step.result).slice(0, 100)}
                          </div>
                          <div className="text-muted-foreground/60 mt-0.5">{step.timestamp && formatRelativeTime(step.timestamp)}</div>
                        </div>
                        <Badge className={`text-[10px] shrink-0 ${getStatusColor(step.status)}`}>{step.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {run.error && (
              <div className="mt-2 text-xs text-red-400 bg-red-500/10 rounded-lg p-2">{run.error}</div>
            )}
          </div>
          {run.status === "running" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-400"
              onClick={() => cancelMutation.mutate()}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AgentRunsPage() {
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["agent-runs", page],
    queryFn: () => api.get<any>(`/agent/runs?page=${page}&limit=20`),
    refetchInterval: 5000, // Auto-refresh for running agents
  });

  const runs = data?.runs || [];
  const pagination = data?.pagination || { total: 0, pages: 1 };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6 text-indigo-400" /> Agent Runs
          </h1>
          <p className="text-sm text-muted-foreground">{pagination.total} total runs</p>
        </div>
        <Button
          className="bg-indigo-600 hover:bg-indigo-500"
          onClick={() => {
            api.post("/agent/runs", { approvalMode: "draft" }).then(() => {
              toast({ title: "Agent run started" });
              qc.invalidateQueries({ queryKey: ["agent-runs"] });
            }).catch((e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }));
          }}
          data-testid="btn-start-agent"
        >
          <Play className="w-4 h-4" /> Start run
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Bot className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-semibold mb-1">No agent runs yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Start a run from a job detail page or click Start run</p>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run: any) => (
            <AgentRunCard key={run.id} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}
