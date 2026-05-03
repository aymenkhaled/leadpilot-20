import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { getStatusColor, formatRelativeTime } from "@/lib/utils";
import {
  Bot, Play, X, ChevronDown, ChevronUp, CheckCircle, XCircle, Loader,
  Clock, ChevronLeft, ChevronRight,
} from "lucide-react";

const STEP_ICONS: Record<string, string> = {
  research_account: "🔍",
  identify_decision_maker: "👤",
  draft_email: "✍️",
  send_email: "📤",
  awaiting_approval: "⏳",
  monitor_reply: "📬",
};

const APPROVAL_LABELS: Record<string, string> = {
  autonomous: "Autonomous",
  approve_before_send: "Approve first",
  draft: "Draft only",
};

function AgentRunCard({ run }: { run: any }) {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/agent/runs/${run.id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-runs"] }),
    onError: (e: any) => toast({ title: "Failed to cancel", description: e.message, variant: "destructive" }),
  });

  const retryMutation = useMutation({
    mutationFn: () => api.post<any>(`/agent/runs/${run.id}/retry`),
    onSuccess: () => {
      toast({ title: "Retry queued", description: "A new agent run has been started" });
      qc.invalidateQueries({ queryKey: ["agent-runs"] });
    },
    onError: (e: any) => toast({ title: "Failed to retry", description: e.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: () => {
      const draft = run.result?.emailDraft;
      if (!draft || !run.result?.contactId) throw new Error("No draft to approve");
      return api.post("/outreach", {
        jobId: run.jobId,
        contactId: run.result.contactId,
        subject: draft.subject,
        body: draft.body,
        status: "draft",
      });
    },
    onSuccess: () => {
      toast({ title: "Draft saved to Outreach", description: "Go to Outreach to send" });
      qc.invalidateQueries({ queryKey: ["agent-runs"] });
    },
    onError: (e: any) => toast({ title: "Failed to approve", description: e.message, variant: "destructive" }),
  });

  const steps = (run.steps || []) as any[];

  return (
    <Card className="gradient-top-border bg-card/50 border-border/50 hover-glow transition-all">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
            {run.status === "running" ? (
              <Loader className="w-4 h-4 text-indigo-400 animate-spin" />
            ) : run.status === "completed" ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : run.status === "failed" ? (
              <XCircle className="w-4 h-4 text-red-400" />
            ) : run.status === "cancelled" ? (
              <X className="w-4 h-4 text-zinc-400" />
            ) : (
              <Clock className="w-4 h-4 text-zinc-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-medium text-sm">
                {run.jobTitle ? run.jobTitle : "Agent Run"}
                {run.jobCompany ? <span className="font-normal text-muted-foreground"> — {run.jobCompany}</span> : null}
              </span>
              <Badge className={`text-[10px] ${getStatusColor(run.status)}`}>{run.status}</Badge>
              <Badge variant="outline" className="text-[10px]">{APPROVAL_LABELS[run.approvalMode] || run.approvalMode}</Badge>
              {run.totalTokensUsed > 0 && (
                <span className="text-[10px] text-muted-foreground">{run.totalTokensUsed.toLocaleString()} tokens</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Started {formatRelativeTime(run.createdAt)}
              {run.completedAt && (
                <>
                  {" · "}
                  <span title={`Completed ${formatRelativeTime(run.completedAt)}`}>
                    {(() => {
                      const ms = new Date(run.completedAt).getTime() - new Date(run.createdAt).getTime();
                      if (ms < 60000) return `${Math.round(ms / 1000)}s`;
                      return `${Math.round(ms / 60000)}m`;
                    })()}
                  </span>
                </>
              )}
              {run.contactName && <span> · Contact: <span className="text-foreground/70">{run.contactName}</span></span>}
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
                        <span className="text-base shrink-0">{STEP_ICONS[step.step] || "▪️"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium capitalize">{step.step.replace(/_/g, " ")}</div>
                          <div className="text-muted-foreground mt-0.5 break-words">
                            {typeof step.result === "string"
                              ? step.result
                              : step.result?.subject
                                ? `Subject: "${step.result.subject}"`
                                : JSON.stringify(step.result).slice(0, 120)}
                          </div>
                          {step.timestamp && (
                            <div className="text-muted-foreground/60 mt-0.5">{formatRelativeTime(step.timestamp)}</div>
                          )}
                        </div>
                        <Badge className={`text-[10px] shrink-0 ${getStatusColor(step.status)}`}>{step.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {run.result?.emailDraft && (
              <div className="mt-2 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-semibold text-indigo-400 flex items-center gap-1.5">✍️ Generated draft</div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                      onClick={() => {
                        const draft = run.result?.emailDraft;
                        if (!draft) return;
                        navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
                        import("@/hooks/use-toast").then(m => m.toast({ title: "Draft copied to clipboard" }));
                      }}
                      title="Copy draft to clipboard"
                    >
                      Copy
                    </Button>
                    {run.result?.contactId && (
                      <Button
                        size="sm"
                        className="h-6 text-[10px] bg-green-600 hover:bg-green-500 px-2"
                        onClick={() => approveMutation.mutate()}
                        disabled={approveMutation.isPending}
                        loading={approveMutation.isPending}
                      >
                        Save to Outreach
                      </Button>
                    )}
                  </div>
                </div>
                <div className="text-muted-foreground font-medium">Subject: <span className="text-foreground/80">{run.result.emailDraft.subject}</span></div>
                <div className="text-muted-foreground/70 leading-relaxed line-clamp-3 border-t border-indigo-500/10 pt-1.5">{run.result.emailDraft.body?.substring(0, 200)}{run.result.emailDraft.body?.length > 200 ? "…" : ""}</div>
              </div>
            )}

            {run.error && (
              <div className="mt-2 text-xs text-red-400 bg-red-500/10 rounded-lg p-2">{run.error}</div>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            {(run.status === "failed" || run.status === "cancelled") && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-indigo-400"
                onClick={() => retryMutation.mutate()}
                disabled={retryMutation.isPending}
                title="Retry run"
              >
                <Play className="w-3.5 h-3.5" />
              </Button>
            )}
            {run.status === "running" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-red-400"
                onClick={() => cancelMutation.mutate()}
                title="Cancel run"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AgentRunsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [approvalFilter, setApprovalFilter] = useState("all");
  const qc = useQueryClient();

  const params = new URLSearchParams({
    page: page.toString(),
    limit: "20",
    ...(statusFilter !== "all" && { status: statusFilter }),
    ...(approvalFilter !== "all" && { approvalMode: approvalFilter }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["agent-runs", page, statusFilter, approvalFilter],
    queryFn: () => api.get<any>(`/agent/runs?${params}`),
    refetchInterval: 5000,
  });

  const runs = data?.runs || [];
  const pagination = data?.pagination || { total: 0, pages: 1 };

  function startRun(approvalMode: string) {
    api.post("/agent/runs", { approvalMode })
      .then(() => {
        toast({ title: "Agent run started", description: `Mode: ${APPROVAL_LABELS[approvalMode]}` });
        qc.invalidateQueries({ queryKey: ["agent-runs"] });
      })
      .catch((e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }));
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-indigo-400" />
            </div>
            Agent Runs
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pagination.total} total runs · auto-refreshing
            {pagination.total > 0 && data?.successRate !== undefined && (
              <span className="ml-2 text-green-400 font-medium">{data.successRate}% success</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => startRun("draft")}
            title="Generate draft pitches without sending"
          >
            <Play className="w-3.5 h-3.5" /> Draft run
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => startRun("approve_before_send")}
            title="Generate pitches and wait for your approval before sending"
          >
            <Play className="w-3.5 h-3.5" /> Approve first
          </Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-500"
            onClick={() => startRun("autonomous")}
            title="Run agent in full autonomous mode"
            data-testid="btn-start-agent"
          >
            <Play className="w-4 h-4" /> Autonomous run
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={approvalFilter} onValueChange={v => { setApprovalFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modes</SelectItem>
            <SelectItem value="autonomous">Autonomous</SelectItem>
            <SelectItem value="approve_before_send">Approve first</SelectItem>
            <SelectItem value="draft">Draft only</SelectItem>
          </SelectContent>
        </Select>
        {(statusFilter !== "all" || approvalFilter !== "all") && (
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => { setStatusFilter("all"); setApprovalFilter("all"); setPage(1); }}
          >
            Clear filters
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border/40 rounded-2xl bg-card/20">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
            <Bot className="w-7 h-7 text-indigo-400/50" />
          </div>
          <h3 className="font-semibold mb-1.5">
            {statusFilter !== "all" || approvalFilter !== "all" ? "No matching runs" : "No agent runs yet"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {statusFilter !== "all" || approvalFilter !== "all"
              ? "Try adjusting your filters"
              : "Start a Draft run to generate pitches, or an Autonomous run to send automatically"}
          </p>
          {statusFilter !== "all" || approvalFilter !== "all" ? (
            <Button variant="outline" size="sm" onClick={() => { setStatusFilter("all"); setApprovalFilter("all"); setPage(1); }}>
              Clear filters
            </Button>
          ) : (
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => startRun("draft")}>
                <Play className="w-3.5 h-3.5" /> Draft run
              </Button>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500" onClick={() => startRun("autonomous")}>
                <Play className="w-3.5 h-3.5" /> Autonomous run
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run: any) => (
            <div key={run.id} className={run.result?.emailDraft && run.result?.contactId && run.status === "completed" ? "ring-1 ring-green-500/30 rounded-xl" : ""}>
              <AgentRunCard run={run} />
            </div>
          ))}
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {pagination.pages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
