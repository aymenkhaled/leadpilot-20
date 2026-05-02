import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { getSignalIcon, getSignalColor, formatRelativeTime } from "@/lib/utils";
import { Zap, ArrowRight, Check, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

const SIGNAL_TYPES = ["funding", "hiring_spike", "job_change", "tech_install", "leadership_change"];
const SIGNAL_LABELS: Record<string, string> = {
  funding: "💰 Funding",
  hiring_spike: "📈 Hiring Spike",
  job_change: "🔄 Job Change",
  tech_install: "🔧 Tech Install",
  leadership_change: "👤 Leadership",
};

const STRENGTH_COLORS: Record<string, string> = {
  strong: "bg-red-500/20 text-red-400",
  moderate: "bg-yellow-500/20 text-yellow-400",
  weak: "bg-zinc-500/20 text-zinc-400",
};

export default function SignalsPage() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("all");
  const [strengthFilter, setStrengthFilter] = useState("all");
  const qc = useQueryClient();

  const params = new URLSearchParams({
    page: page.toString(),
    limit: "20",
    ...(typeFilter !== "all" && { type: typeFilter }),
    ...(strengthFilter !== "all" && { strength: strengthFilter }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["signals", page, typeFilter, strengthFilter],
    queryFn: () => api.get<any>(`/signals?${params}`),
  });

  const { data: stats } = useQuery({
    queryKey: ["signals", "stats"],
    queryFn: () => api.get<any>("/signals/stats"),
  });

  const actMutation = useMutation({
    mutationFn: (id: string) => api.post(`/signals/${id}/act`),
    onSuccess: () => {
      toast({ title: "Signal marked as acted on" });
      qc.invalidateQueries({ queryKey: ["signals"] });
    },
  });

  const signals = data?.signals || [];
  const pagination = data?.pagination || { page: 1, pages: 1, total: 0 };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-400" /> Intent Signals
          </h1>
          <p className="text-sm text-muted-foreground">{pagination.total} signals detected</p>
        </div>
      </div>

      {/* Stats */}
      {stats?.byType && stats.byType.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {stats.byType.map((t: any) => (
            <Card key={t.type} className={`bg-card/50 border-border/50 cursor-pointer hover:border-indigo-500/30 transition-colors ${typeFilter === t.type ? "border-indigo-500/50" : ""}`}
              onClick={() => setTypeFilter(typeFilter === t.type ? "all" : t.type)}>
              <CardContent className="p-3 text-center">
                <div className="text-xl mb-1">{getSignalIcon(t.type)}</div>
                <div className="text-lg font-bold">{t.count}</div>
                <div className="text-xs text-muted-foreground">{SIGNAL_LABELS[t.type] || t.type}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Signal type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {SIGNAL_TYPES.map(t => (
              <SelectItem key={t} value={t}>{SIGNAL_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={strengthFilter} onValueChange={v => { setStrengthFilter(v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Strength" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All strengths</SelectItem>
            <SelectItem value="strong">🔴 Strong</SelectItem>
            <SelectItem value="moderate">🟡 Moderate</SelectItem>
            <SelectItem value="weak">⚪ Weak</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Signal list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : signals.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Zap className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-semibold mb-1">No signals detected yet</h3>
          <p className="text-sm text-muted-foreground">Signals are automatically detected from job postings you scrape</p>
        </div>
      ) : (
        <div className="space-y-2">
          {signals.map((signal: any) => (
            <Card
              key={signal.id}
              className={`bg-card/50 border-border/50 hover:border-indigo-500/20 transition-colors ${signal.actedOnAt ? "opacity-60" : ""}`}
              data-testid={`signal-${signal.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="text-2xl">{getSignalIcon(signal.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{signal.title}</span>
                      <Badge className={`text-[10px] ${STRENGTH_COLORS[signal.strength]}`}>{signal.strength}</Badge>
                      {signal.actedOnAt && <Badge variant="success" className="text-[10px]">Acted on</Badge>}
                    </div>
                    {signal.description && (
                      <p className="text-xs text-muted-foreground mb-1.5">{signal.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatRelativeTime(signal.detectedAt)}</span>
                      {signal.sourceName && <span>via {signal.sourceName}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {signal.sourceUrl && (
                      <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                        <a href={signal.sourceUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                    )}
                    {!signal.actedOnAt && (
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500"
                        onClick={() => actMutation.mutate(signal.id)}
                        loading={actMutation.isPending}
                      >
                        Act now <ArrowRight className="w-3 h-3" />
                      </Button>
                    )}
                    {signal.actedOnAt && (
                      <Badge variant="success" className="text-xs flex items-center gap-1">
                        <Check className="w-3 h-3" /> Done
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="flex items-center text-sm text-muted-foreground px-2">
            {page} / {pagination.pages}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
